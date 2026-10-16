"""Build static/model/coinflip-1p.onnx: p = Sigmoid(z * w * 1.5), exactly ONE trainable initializer (w).
w is stored as the ternary-quantized value used at inference (+1, see src/lib/model.ts WEIGHT);
the pre-quantization float 0.4271 is recorded in metadata. Run: python3 scripts/build-onnx.py"""
SCALE = 1.5  # keep in sync with src/lib/model.ts SCALE
import numpy as np, onnx, onnxruntime as ort
from onnx import helper as h, TensorProto as T, numpy_helper as nh

w = nh.from_array(np.array([1.0], np.float32), "w")  # THE parameter
ten = h.make_node("Constant", [], ["scale"], value=nh.from_array(np.array([SCALE], np.float32)))  # constant, not trainable
g = h.make_graph(
    [ten, h.make_node("Mul", ["z", "w"], ["a"]), h.make_node("Mul", ["a", "scale"], ["logit"]), h.make_node("Sigmoid", ["logit"], ["p"])],
    "CoinFlip-1P", [h.make_tensor_value_info("z", T.FLOAT, [1])], [h.make_tensor_value_info("p", T.FLOAT, [1])], [w])
m = h.make_model(g, producer_name="coinflip-ai", opset_imports=[h.make_opsetid("", 17)], ir_version=8,
                 doc_string="CoinFlip-1P b1.58: one ternary weight. Parameters: 1.")
for k, v in {"w_fp32_prequant": "0.4271", "quantization": "ternary b1.58 round(clip(w/mean|w|))", "parameters": "1"}.items():
    m.metadata_props.add(key=k, value=v)
onnx.checker.check_model(m)
onnx.save(m, "static/model/coinflip-1p.onnx")

s = ort.InferenceSession("static/model/coinflip-1p.onnx")
for z in np.linspace(-4, 4, 81, dtype=np.float32):
    p = s.run(None, {"z": np.array([z], np.float32)})[0][0]
    ref = 1 / (1 + np.exp(-(1.0 * float(z) * SCALE)))
    assert abs(p - ref) < 1e-6, (z, p, ref)
print("ok: onnxruntime matches σ(w·z·1.5); initializers:", [i.name for i in m.graph.initializer])

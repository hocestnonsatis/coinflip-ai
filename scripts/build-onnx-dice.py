"""Build static/model/diceroll-6p.onnx: p = Softmax((g + b) * T), exactly ONE trainable initializer b (6 values).
Run: python3 scripts/build-onnx-dice.py"""
import numpy as np, onnx, onnxruntime as ort
from onnx import helper as h, TensorProto as T, numpy_helper as nh
TEMP = 1.0  # keep in sync with src/lib/dice-model.ts
b = nh.from_array(np.full([6], 1 / 6, np.float32), "b")  # THE six parameters
t = h.make_node("Constant", [], ["temp"], value=nh.from_array(np.array([TEMP], np.float32)))
g = h.make_graph([t, h.make_node("Add", ["g", "b"], ["x"]), h.make_node("Mul", ["x", "temp"], ["logits"]), h.make_node("Softmax", ["logits"], ["p"], axis=-1)],
    "DiceRoll-6P", [h.make_tensor_value_info("g", T.FLOAT, [1, 6])], [h.make_tensor_value_info("p", T.FLOAT, [1, 6])], [b])
m = h.make_model(g, producer_name="tiny-models", opset_imports=[h.make_opsetid("", 17)], ir_version=8, doc_string="DiceRoll-6P: six biases, one softmax. Parameters: 6.")
m.metadata_props.add(key="parameters", value="6")
onnx.checker.check_model(m); onnx.save(m, "static/model/diceroll-6p.onnx")
s = ort.InferenceSession("static/model/diceroll-6p.onnx")
rng = np.random.default_rng(0)
for _ in range(500):
    gg = -np.log(-np.log(rng.random((1, 6)))).astype(np.float32)
    p = s.run(None, {"g": gg})[0]
    x = (gg.astype(np.float64) + 1 / 6) * TEMP; ref = np.exp(x - x.max()); ref /= ref.sum()
    assert np.abs(p - ref).max() < 1e-6 and p.argmax() == gg.argmax()
print("ok: onnxruntime matches softmax((g+b)·T); initializers:", [(i.name, list(i.dims)) for i in m.graph.initializer])

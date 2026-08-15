/**
 * 序列化器 - 积木图 <-> JSON 转换
 */
const Serializer = (function () {
  function serialize(blocks) {
    return JSON.stringify(blocks, null, 2);
  }
  function deserialize(json) {
    try { return JSON.parse(json); } catch { return {}; }
  }
  return { serialize, deserialize };
})();

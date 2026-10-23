/**
 * state.js
 * ---------------------------------------------------------------------------
 * Persistência local (sessionStorage) do resultado do cruzamento, para passar
 * dados da tela de upload para a tela de relatório sem backend. Serializa
 * Map/Set/Date, que não sobrevivem a JSON.stringify puro.
 * ---------------------------------------------------------------------------
 */
window.TITAN_STATE = (function () {
  const CHAVE = "titan_recebimento_v1";

  function substituto(_key, value) {
    if (value instanceof Map) return { __type: "Map", value: Array.from(value.entries()) };
    if (value instanceof Set) return { __type: "Set", value: Array.from(value.values()) };
    if (value instanceof Date) return { __type: "Date", value: value.toISOString() };
    return value;
  }
  function reviver(_key, value) {
    if (value && typeof value === "object" && value.__type === "Map") return new Map(value.value);
    if (value && typeof value === "object" && value.__type === "Set") return new Set(value.value);
    if (value && typeof value === "object" && value.__type === "Date") return new Date(value.value);
    return value;
  }

  function salvar(payload) {
    sessionStorage.setItem(CHAVE, JSON.stringify(payload, substituto));
  }
  function carregar() {
    const bruto = sessionStorage.getItem(CHAVE);
    if (!bruto) return null;
    try { return JSON.parse(bruto, reviver); } catch (e) { return null; }
  }
  function limpar() {
    sessionStorage.removeItem(CHAVE);
  }

  return { salvar, carregar, limpar };
})();

window.TITAN_FORMAT = (function () {
  function numero(n) {
    const v = Number(n) || 0;
    return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }
  function decimal(n, casas) {
    casas = casas === undefined ? 2 : casas;
    return (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  }
  function diasCobertura(dias) {
    if (dias === null || dias === undefined) return "—";
    return decimal(dias, 1);
  }
  function data(d) {
    if (!d) return "";
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt)) return "";
    return dt.toLocaleDateString("pt-BR");
  }
  function dataHora(d) {
    if (!d) return "";
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt)) return "";
    return dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function posicoesAel(mapaPosicoes) {
    if (!mapaPosicoes || mapaPosicoes.size === 0) return "—";
    const chaves = Array.from(mapaPosicoes.keys()).sort();
    return chaves.map((pos) => {
      const qtd = mapaPosicoes.get(pos);
      const qtdFmt = Number.isInteger(qtd) ? qtd : decimal(qtd, 1);
      return `${pos} (${qtdFmt})`;
    }).join(" / ");
  }
  function docaHorario(item) {
    const doca = item.doca_entrega || "";
    const dt = item.data_inicio;
    const dataFmt = dt ? dataHora(dt) : "";
    if (doca && dataFmt) return `${doca}<br>${dataFmt}`;
    return doca || dataFmt || "";
  }
  return { numero, decimal, diasCobertura, data, dataHora, posicoesAel, docaHorario };
})();

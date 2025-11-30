import * as d3 from 'd3';

let svg1, svg2;
let globalMapaVotos = {};
let globalMapaRegioes = {};
let selectedStateSigla = null;

const regioes = {
    'AC': 'Norte', 'AP': 'Norte', 'AM': 'Norte', 'PA': 'Norte', 'RO': 'Norte', 'RR': 'Norte', 'TO': 'Norte',
    'AL': 'Nordeste', 'BA': 'Nordeste', 'CE': 'Nordeste', 'MA': 'Nordeste', 'PB': 'Nordeste', 'PE': 'Nordeste', 'PI': 'Nordeste', 'RN': 'Nordeste', 'SE': 'Nordeste',
    'DF': 'Centro-Oeste', 'GO': 'Centro-Oeste', 'MT': 'Centro-Oeste', 'MS': 'Centro-Oeste',
    'ES': 'Sudeste', 'MG': 'Sudeste', 'RJ': 'Sudeste', 'SP': 'Sudeste',
    'PR': 'Sul', 'RS': 'Sul', 'SC': 'Sul'
};

function getCandidateColor(nome) {
    const n = nome ? nome.toUpperCase() : '';
    if (n.includes('LULA')) return '#c4122d';      
    if (n.includes('BOLSONARO')) return '#002f6c';  
    if (n.includes('CIRO')) return '#9d2cb0';       
    if (n.includes('TEBET')) return '#eeb307';      
    if (n.includes('SORAYA')) return '#00a859';     
    if (n.includes('D\'AVILA')) return '#ff6600';   
    if (n.includes('OUTROS')) return '#999999';     
    return '#6c757d'; 
}

export async function loadDashboard(geojson, data) {
    const mapaVotos = {};
    const mapaRegioes = {};
    
    data.forEach(d => {
        if (!mapaVotos[d.ESTADO]) mapaVotos[d.ESTADO] = {};
        if (!mapaVotos[d.ESTADO][d.TURNO]) mapaVotos[d.ESTADO][d.TURNO] = { maxVotos: 0, vencedor: 'N/A', total: 0, dados: [] };
        
        const turnoData = mapaVotos[d.ESTADO][d.TURNO];
        turnoData.dados.push(d); 
        turnoData.total += d.TOTAL_VOTOS;

        if (d.TOTAL_VOTOS > turnoData.maxVotos) {
            turnoData.maxVotos = d.TOTAL_VOTOS;
            turnoData.vencedor = d.CANDIDATO;
        }

        const regiao = regioes[d.ESTADO];
        if (regiao) {
            if (!mapaRegioes[regiao]) mapaRegioes[regiao] = {};
            if (!mapaRegioes[regiao][d.TURNO]) mapaRegioes[regiao][d.TURNO] = { dados: {} };

            const rData = mapaRegioes[regiao][d.TURNO];
            if (!rData.dados[d.CANDIDATO]) rData.dados[d.CANDIDATO] = 0;
            rData.dados[d.CANDIDATO] += d.TOTAL_VOTOS;
        }
    });

    globalMapaVotos = mapaVotos;
    globalMapaRegioes = mapaRegioes;
    selectedStateSigla = null;

    d3.select('#map1').html('');
    d3.select('#map2').html('');

    svg1 = d3.select('#map1').append('svg').attr('width', '100%').attr('height', '100%');
    svg2 = d3.select('#map2').append('svg').attr('width', '100%').attr('height', '100%');
    
    renderMap(svg1, geojson, mapaVotos, 1);
    renderMap(svg2, geojson, mapaVotos, 2);

    setupSyncZoom(svg1, svg2);
}

function renderMap(svg, geojson, mapaVotos, turno) {
    const container = svg.node().parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const projection = d3.geoMercator().fitExtent([[20, 20], [width-20, height-20]], geojson);
    const path = d3.geoPath().projection(projection);

    const g = svg.append('g').attr('class', 'map-layer');

    const getColor = (sigla) => {
        const info = mapaVotos[sigla]?.[turno];
        if (!info) return '#eee';
        return getCandidateColor(info.vencedor);
    };

    const paths = g.selectAll('path')
        .data(geojson.features)
        .join('path')
        .attr('d', path)
        .attr('class', 'state-path') 
        .attr('id', d => `state-${d.properties.SIGLA}-${turno}`) 
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5)
        .attr('fill', d => getColor(d.properties.SIGLA))
        .style('cursor', 'pointer');

    paths
        .on('mouseover', function(e, d) {
            const sigla = d.properties.SIGLA;
            if (sigla !== selectedStateSigla) {
                d3.selectAll('.state-path').filter(p => p && p.properties.SIGLA === sigla)
                  .attr('opacity', 0.6)
                  .attr('stroke', '#333')
                  .attr('stroke-width', 1);
            }
        })
        .on('mouseout', function(e, d) {
            const sigla = d.properties.SIGLA;
            if (sigla !== selectedStateSigla) {
                d3.selectAll('.state-path').filter(p => p && p.properties.SIGLA === sigla)
                  .attr('opacity', 1)
                  .attr('stroke', '#fff')
                  .attr('stroke-width', 0.5);
            }
        })
        .on('click', (e, d) => {
            e.stopPropagation();
            const sigla = d.properties.SIGLA;
            selectedStateSigla = sigla;

            d3.selectAll('.state-path')
                .attr('opacity', 1)
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.5)
                .classed('selected-state', false);

            d3.selectAll('.state-path').filter(p => p && p.properties.SIGLA === sigla)
                .classed('selected-state', true)
                .attr('stroke', '#000') 
                .attr('stroke-width', 2)
                .raise();

            updateCharts(sigla, turno, globalMapaVotos[sigla]);
        });
        
    paths.append('title').text(d => `${d.properties.SIGLA} (Turno ${turno})`);

    renderLegend(svg, [
        { label: 'Lula', color: getCandidateColor('LULA') },
        { label: 'Bolsonaro', color: getCandidateColor('BOLSONARO') }
    ], 20, height - 60);
}

function setupSyncZoom(s1, s2) {
    const zoom = d3.zoom()
        .scaleExtent([1, 10])
        .on('zoom', ({transform}) => {
            s1.select('.map-layer').attr('transform', transform);
            s2.select('.map-layer').attr('transform', transform);
        });
    s1.call(zoom);
    s2.call(zoom);
}

function updateCharts(sigla, turnoSelecionado, dadosEstado) {
    d3.select('#chart-info').html(`<h3>Estado: ${sigla} (Turno ${turnoSelecionado})</h3>`);

    if (!dadosEstado) return;

    const dadosTurnoAtual = dadosEstado[turnoSelecionado]?.dados || [];
    d3.select('#chart-ranking').html('').append('h4').text(`Ranking (${turnoSelecionado}º Turno)`);
    renderTop5('#chart-ranking', dadosTurnoAtual);

    const regiao = regioes[sigla];
    const dadosRegiaoObj = globalMapaRegioes[regiao]?.[turnoSelecionado]?.dados || {};
    const dadosRegiaoArr = Object.keys(dadosRegiaoObj).map(key => ({
        CANDIDATO: key,
        TOTAL_VOTOS: dadosRegiaoObj[key]
    }));

    d3.select('#chart-distribution').html('').append('h4').text(`Região ${regiao} (${turnoSelecionado}º Turno)`);
    renderDistribution('#chart-distribution', dadosRegiaoArr);

    const candT1 = dadosEstado[1]?.dados || [];
    const candT2 = dadosEstado[2]?.dados || [];
    
    const getVotos = (arr, nomeBusca) => {
        const c = arr.find(d => d.CANDIDATO.toUpperCase().includes(nomeBusca));
        return c ? c.TOTAL_VOTOS : 0;
    };
    const dataEvolucao = [
        { candidato: 'Lula', t1: getVotos(candT1, 'LULA'), t2: getVotos(candT2, 'LULA'), color: getCandidateColor('LULA') },
        { candidato: 'Bolsonaro', t1: getVotos(candT1, 'BOLSONARO'), t2: getVotos(candT2, 'BOLSONARO'), color: getCandidateColor('BOLSONARO') }
    ];

    d3.select('#chart-evolution').html('');
    renderEvolution('#chart-evolution', dataEvolucao);

    const totalT1 = dadosEstado[1]?.total || 0;
    const totalT2 = dadosEstado[2]?.total || 0;
    const dataTotal = [
        { turno: '1º Turno', total: totalT1 },
        { turno: '2º Turno', total: totalT2 }
    ];

    d3.select('#chart-totals').html('');
    renderTotals('#chart-totals', dataTotal);
}

function renderLegend(svg, items, xPos, yPos) {
    const legendGroup = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${xPos}, ${yPos})`);

    legendGroup.append('rect')
        .attr('x', -5).attr('y', -10)
        .attr('width', 100).attr('height', items.length * 20 + 10)
        .attr('fill', 'rgba(255,255,255,0.8)')
        .attr('rx', 5);

    items.forEach((item, i) => {
        const g = legendGroup.append('g').attr('transform', `translate(0, ${i * 20})`);
        g.append('rect')
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', item.color)
            .attr('opacity', item.opacity !== undefined ? item.opacity : 1);
            
        g.append('text').attr('x', 18).attr('y', 10).text(item.label).style('font-size', '11px').style('fill', '#333');
    });
}

function renderTop5(selector, dados) {
    const container = d3.select(selector);
    const topDados = dados.sort((a, b) => b.TOTAL_VOTOS - a.TOTAL_VOTOS).slice(0, 5);
    
    const containerWidth = container.node().getBoundingClientRect().width;
    const width = containerWidth > 0 ? containerWidth : 400; 
    const height = 250;
    
    const maxNameLength = d3.max(topDados, d => d.CANDIDATO.length) || 10;
    const marginLeft = Math.max(120, maxNameLength * 8); 
    const marginRight = 90; 
    const totalWidth = marginLeft + 220 + marginRight;

    const margin = {top: 10, right: marginRight, bottom: 20, left: marginLeft};

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${totalWidth} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', '100%');

    const y = d3.scaleBand()
        .domain(topDados.map(d => d.CANDIDATO))
        .range([margin.top, height - margin.bottom])
        .padding(0.3);

    const x = d3.scaleLinear()
        .domain([0, d3.max(topDados, d => d.TOTAL_VOTOS)])
        .range([margin.left, totalWidth - margin.right]);

    svg.append('g')
        .selectAll('rect')
        .data(topDados)
        .join('rect')
        .attr('x', x(0))
        .attr('y', d => y(d.CANDIDATO))
        .attr('width', d => x(d.TOTAL_VOTOS) - x(0))
        .attr('height', y.bandwidth())
        .attr('fill', d => getCandidateColor(d.CANDIDATO));

    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickSize(0))
        .selectAll("text").style("font-weight", "bold").style("font-size", "12px");

    svg.append('g')
        .selectAll('text.val')
        .data(topDados)
        .join('text')
        .attr('class', 'val')
        .attr('x', d => x(d.TOTAL_VOTOS) + 5)
        .attr('y', d => y(d.CANDIDATO) + y.bandwidth() / 2)
        .attr('dy', '0.35em')
        .text(d => d3.format(".2s")(d.TOTAL_VOTOS))
        .style("font-size", "11px")
        .style("fill", "#000")
        .style("font-weight", "bold");
}

function renderDistribution(selector, dados) {
    const container = d3.select(selector);
    const containerWidth = container.node().getBoundingClientRect().width;
    const width = containerWidth > 0 ? containerWidth : 400;
    const height = 250;
    const radius = Math.min(width, height) / 2 - 20;

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', '100%')
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

    const sorted = dados.sort((a, b) => b.TOTAL_VOTOS - a.TOTAL_VOTOS);
    const topCandidates = sorted.slice(0, 3);
    const othersVote = sorted.slice(3).reduce((acc, curr) => acc + curr.TOTAL_VOTOS, 0);
    
    const plotData = [...topCandidates];
    if (othersVote > 0) plotData.push({ CANDIDATO: 'OUTROS', TOTAL_VOTOS: othersVote });

    const pie = d3.pie().value(d => d.TOTAL_VOTOS).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius * 0.85);
    const arcLabel = d3.arc().innerRadius(radius * 0.95).outerRadius(radius * 0.95);

    const totalVotos = d3.sum(plotData, d => d.TOTAL_VOTOS);

    svg.selectAll('path')
        .data(pie(plotData))
        .join('path')
        .attr('d', arc)
        .attr('fill', d => getCandidateColor(d.data.CANDIDATO))
        .attr('stroke', 'white')
        .style('stroke-width', '2px')
        .append('title')
        .text(d => `${d.data.CANDIDATO}: ${(d.data.TOTAL_VOTOS / totalVotos * 100).toFixed(1)}%`);

    svg.selectAll('text.percent')
        .data(pie(plotData))
        .join('text')
        .attr('transform', d => `translate(${arcLabel.centroid(d)})`)
        .style('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .style('fill', '#000') 
        .text(d => {
            const percent = (d.data.TOTAL_VOTOS / totalVotos * 100);
            return percent > 4 ? `${percent.toFixed(0)}%` : ''; 
        });
        
    svg.append("text")
       .attr("text-anchor", "middle").attr("dy", "0.3em")
       .style("font-size", "14px").style("font-weight", "bold").text("Votos");

    const legendData = plotData.map(d => ({ label: d.CANDIDATO, color: getCandidateColor(d.CANDIDATO) }));
    renderLegend(d3.select(selector).select('svg'), legendData, 10, 10);
}

function renderEvolution(selector, data) {
    const container = d3.select(selector);
    const width = 400;
    const height = 220; 
    const margin = {top: 40, right: 30, bottom: 30, left: 60};

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', '100%');

    const x0 = d3.scaleBand()
        .domain(data.map(d => d.candidato))
        .rangeRound([margin.left, width - margin.right])
        .paddingInner(0.3);

    const x1 = d3.scaleBand()
        .domain(['t1', 't2'])
        .rangeRound([0, x0.bandwidth()])
        .padding(0.05);

    const maxVal = d3.max(data, d => Math.max(d.t1, d.t2));
    const y = d3.scaleLinear()
        .domain([0, maxVal * 1.2]) 
        .rangeRound([height - margin.bottom, margin.top]);

    const formatVal = d3.format(".2s");

    const group = svg.append("g")
        .selectAll("g")
        .data(data)
        .join("g")
        .attr("transform", d => `translate(${x0(d.candidato)},0)`);

    group.append("rect")
        .attr("x", x1('t1')).attr("y", d => y(d.t1))
        .attr("width", x1.bandwidth()).attr("height", d => Math.max(0, y(0) - y(d.t1))) 
        .attr("fill", d => d.color).attr("opacity", 0.5);

    group.append("rect")
        .attr("x", x1('t2')).attr("y", d => y(d.t2))
        .attr("width", x1.bandwidth()).attr("height", d => Math.max(0, y(0) - y(d.t2)))
        .attr("fill", d => d.color);

    group.append("text")
        .attr("x", x1('t1') + x1.bandwidth()/2).attr("y", d => y(d.t1) - 5)
        .attr("text-anchor", "middle").text(d => d.t1 > 0 ? formatVal(d.t1) : "")
        .style("font-size", "10px").style("fill", "#000");

    group.append("text")
        .attr("x", x1('t2') + x1.bandwidth()/2).attr("y", d => y(d.t2) - 5)
        .attr("text-anchor", "middle").text(d => d.t2 > 0 ? formatVal(d.t2) : "")
        .style("font-size", "10px").style("font-weight", "bold").style("fill", "#000");

    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x0));
    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(4, "s"));
    
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "#666")
        .text("Barras Claras: 1º Turno | Barras Escuras: 2º Turno");
}

function renderTotals(selector, data) {
    const container = d3.select(selector);
    const width = 400;
    const height = 180; 
    
    const margin = {top: 10, right: 130, bottom: 30, left: 80};

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', '100%');

    const colorTurno = d3.scaleOrdinal()
        .domain(['1º Turno', '2º Turno'])
        .range(['#999', '#333']);

    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.total) * 1.2]) 
        .range([margin.left, width - margin.right]);

    const y = d3.scaleBand()
        .domain(data.map(d => d.turno))
        .range([margin.top, height - margin.bottom])
        .padding(0.4);

    svg.append("g")
        .selectAll("rect")
        .data(data)
        .join("rect")
        .attr("x", x(0))
        .attr("y", d => y(d.turno))
        .attr("width", d => x(d.total) - x(0))
        .attr("height", y.bandwidth())
        .attr("fill", d => colorTurno(d.turno));

    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y));

    svg.append("g")
        .selectAll("text.val")
        .data(data)
        .join("text")
        .attr("x", d => x(d.total) + 5)
        .attr("y", d => y(d.turno) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .text(d => d3.format(".3s")(d.total))
        .style("font-size", "11px").style("fill", "#000").style("font-weight", "bold");

    renderLegend(svg, [
        {label: '1º Turno', color: '#999'}, 
        {label: '2º Turno', color: '#333'}
    ], width - 110, height / 2 - 20);
}

export function clearDashboard() {
    d3.select('#map1').html('');
    d3.select('#map2').html('');
    d3.select('#chart-container').html('');
    d3.select('#chart-ranking').html('');
    d3.select('#chart-distribution').html('');
    d3.select('#chart-evolution').html('');
    d3.select('#chart-totals').html('');
    d3.select('#chart-info').html('<h3>Detalhes</h3><p class="placeholder-text">Clique em um estado para ver os dados.</p>');
}
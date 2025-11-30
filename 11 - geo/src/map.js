import * as d3 from 'd3';

export async function loadMap(geojson, votacoes = {}, margens = { left: 5, right: 5, top: 5, bottom: 5 }) {
    const svg = d3.select('svg');

    if (!svg) {
        console.log('SVG element not found');
        return;
    }


    const vencedoresPorEstado = {};
    votacoes.forEach(item => {
        const sigla = item.ESTADO;
        if (!vencedoresPorEstado[sigla]) {
            vencedoresPorEstado[sigla] = { candidato: item.CANDIDATO, votos: item.TOTAL_VOTOS };
        } else if (item.TOTAL_VOTOS > vencedoresPorEstado[sigla].votos) {
            vencedoresPorEstado[sigla] = { candidato: item.CANDIDATO, votos: item.TOTAL_VOTOS };
        }
    });


    const getCor = (sigla) => {
        const vencedor = vencedoresPorEstado[sigla];
        if (!vencedor) return 'lightgray';
        
        if (vencedor.candidato.toUpperCase().includes('BOLSONARO')) {
            return '#0066cc'; // Azul
        } else if (vencedor.candidato.toUpperCase().includes('LULA')) {
            return '#ff0000'; // Vermelho
        }
        return 'lightgray'; // Cinza para outros
    };

    // ---- Tamanho do Gráfico
    const width  = +svg.node().getBoundingClientRect().width  - margens.left - margens.right;
    const height = +svg.node().getBoundingClientRect().height - margens.top  - margens.bottom;

    let projection = d3.geoMercator()
        .fitExtent([[0, 0], [width, height]], geojson);

    let pathBuilder = d3.geoPath()
        .projection(projection);

    const mGroup = svg.selectAll('#group')
        .data([''])
        .join('g')
        .attr('id', 'group')
        .attr('transform', `translate(${margens.left}, ${margens.top})`);

    mGroup.selectAll('path')
        .data(geojson.features)
        .join('path')
        .attr('d', pathBuilder)
        .style('fill', (d) => getCor(d.properties.SIGLA))
        .style('stroke', 'black')
        .on('click', (event, d) => handleClick(event, d, votacoes))
        .append('title')
        .text((d) => {
            const vencedor = vencedoresPorEstado[d.properties.SIGLA];
            return vencedor ? `${d.properties.SIGLA}: ${vencedor.candidato} (${vencedor.votos})` : d.properties.SIGLA;
        })

    const zoom = d3.zoom()
        .scaleExtent([1,10])
        .on('zoom', handleZoom);

    svg.call(zoom);
}

export function clearMap() {
    d3.select('#group')
        .selectAll('path')
        .remove();
    d3.select('#chart-container')
        .selectAll('*')
        .remove();
}

function handleZoom(event){
    const transform = event.transform;
    d3.select("#group")
        .selectAll('path')
        .attr('transform',transform)
}

function handleClick(event, feature, votacoes){
    const sigla = feature.properties.SIGLA;
    
    // Filtrar dados do estado clicado
    const dadosEstado = votacoes.filter(item => item.ESTADO === sigla);
    
    if (dadosEstado.length === 0) {
        console.log('Nenhum dado disponível para este estado');
        return;
    }
    
    // Criar gráfico de barras
    criarGraficoBarras(dadosEstado, sigla);
}

function criarGraficoBarras(dados, sigla) {
    // Limpar container
    const container = d3.select('#chart-container');
    container.selectAll('*').remove();
    
    // Título
    container.append('h3')
        .style('margin', '0 0 10px 0')
        .style('font-size', '1.1em')
        .text(`Votação - ${sigla}`);
    
    // Dimensões do gráfico pequeno
    const margin = { top: 10, right: 10, bottom: 80, left: 40 };
    const width = 280 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    
    // Criar SVG
    const svg = container.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .style('border', '1px solid #ddd')
        .style('border-radius', '4px')
        .style('background', '#fafafa');
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Scales
    const xScale = d3.scaleBand()
        .domain(dados.map(d => d.CANDIDATO))
        .range([0, width])
        .padding(0.1);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(dados, d => d.TOTAL_VOTOS)])
        .range([height, 0]);
    
    // Cores para barras
    const corBarra = (candidato) => {
        const nome = candidato.toUpperCase();
        if (nome.includes('BOLSONARO')) return '#0066cc';
        if (nome.includes('LULA')) return '#ff0000';
        return '#cccccc';
    };
    
    // Barras
    g.selectAll('.bar')
        .data(dados)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.CANDIDATO))
        .attr('y', d => yScale(d.TOTAL_VOTOS))
        .attr('width', xScale.bandwidth())
        .attr('height', d => height - yScale(d.TOTAL_VOTOS))
        .attr('fill', d => corBarra(d.CANDIDATO))
        .append('title')
        .text(d => `${d.CANDIDATO}: ${d.TOTAL_VOTOS.toLocaleString('pt-BR')} votos`);
    
    // Eixo X
    g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .style('font-size', '10px');
    
    // Eixo Y
    g.append('g')
        .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(d3.format('.0s')))
        .style('font-size', '10px');
    
    // Grid horizontal
    g.selectAll('.tick line')
        .style('stroke', '#f0f0f0')
        .style('stroke-dasharray', '2,2');
    
    // Adicionar valores no topo das barras
    g.selectAll('.text-value')
        .data(dados)
        .enter()
        .append('text')
        .attr('class', 'text-value')
        .attr('x', d => xScale(d.CANDIDATO) + xScale.bandwidth() / 2)
        .attr('y', d => yScale(d.TOTAL_VOTOS) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('font-weight', 'bold')
        .text(d => d3.format('.0s')(d.TOTAL_VOTOS));
}


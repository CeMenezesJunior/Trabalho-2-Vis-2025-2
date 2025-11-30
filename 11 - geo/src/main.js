import { Votacoes } from './votacoes';
import { loadDashboard, clearDashboard } from './dash';

const loadBtn = document.querySelector('#loadBtn');
const clearBtn = document.querySelector('#clearBtn');

loadBtn.addEventListener('click', async () => {
    clearDashboard();
    
    const votacoes = new Votacoes();
    await votacoes.init();
    await votacoes.loadVotacoes(); 

    const sql = `
        SELECT 
            ESTADO, 
            TURNO, 
            CANDIDATO, 
            -- CORREÇÃO: Converte BigInt para Integer
            CAST(SUM(VOTOS) AS INTEGER) as TOTAL_VOTOS
        FROM ${votacoes.table}
        WHERE CANDIDATO != 'VOTO NULO' AND CANDIDATO != 'VOTO BRANCO'
        GROUP BY ESTADO, TURNO, CANDIDATO
        ORDER BY TOTAL_VOTOS DESC
    `;
    
    const data = await votacoes.query(sql);
    
    const geoRes = await fetch('br_states.json'); 
    const geojson = await geoRes.json();

    loadDashboard(geojson, data);
});

clearBtn.addEventListener('click', clearDashboard);
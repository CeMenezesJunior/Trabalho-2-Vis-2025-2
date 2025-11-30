import { loadMap, clearMap } from './map';
import { Votacoes } from './votacoes';

function callbacks(data, votacoes) {
    const loadBtn   = document.querySelector('#loadBtn');
    const clearBtn  = document.querySelector('#clearBtn');

    if (!loadBtn || !clearBtn) {
        return;
    }

    loadBtn.addEventListener('click', async () => {
        await loadMap(data, votacoes);
    });

    clearBtn.addEventListener('click', async () => {
        clearMap();
    });
}

window.onload = async () => {
    

    const votacoes = new Votacoes();
    await votacoes.init();

    await votacoes.loadVotacoes();

    const sql = `
        SELECT CANDIDATO, SUM(VOTOS) AS TOTAL_VOTOS, ESTADO, TURNO
        FROM
            ${votacoes.table}
        WHERE CANDIDATO != 'VOTO NULO' AND TURNO = 1
        GROUP BY
            CANDIDATO,
            TURNO,
            ESTADO
        ORDER BY
            ESTADO ASC,
            TOTAL_VOTOS DESC
    `

    try{
        let data = await votacoes.query(sql)
        console.log("Dados de votação:", data);
        const response = await fetch('br_states.json');
        const neighs = await response.json();
        callbacks(neighs, data);
    }catch(e){
        console.error("Falhou ao carregar os dados de votação")
    }

    
};


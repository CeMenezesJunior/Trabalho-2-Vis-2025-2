import { loadDb } from './config';

export class Votacoes {
    async init() {
        this.db = await loadDb();
        this.conn = await this.db.connect();
        this.siglasEstados = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
        this.table = 'votacoes_2022';
    }

    async loadVotacoes() {
        if (!this.db || !this.conn) throw new Error('DB not initialized');

        const files = [];
        const hashName = "f167a93453e74a92ae332513f3f90051-0.parquet";

        for (let i = 0; i < this.siglasEstados.length; i++) {
            const sigla = this.siglasEstados[i];
            const url = `SG_UF=${sigla}/${hashName}`; 
            const key = `votes_${sigla}`;

            try {
                const res = await fetch(url);
                if (!res.ok) continue;
                
                await this.db.registerFileBuffer(key, new Uint8Array(await res.arrayBuffer()));
                files.push({ key, sigla });
                console.log(`Carregado: ${sigla}`);
            } catch (e) {
                console.warn(`Erro ao carregar ${sigla}:`, e);
            }
        }

        if (files.length === 0) throw new Error("Nenhum arquivo carregado.");

        const queries = files.map(f => `
            SELECT 
                NM_VOTAVEL as CANDIDATO,
                CAST(QT_VOTOS AS INT) as VOTOS,
                CAST(NR_TURNO AS INT) as TURNO,
                '${f.sigla}' as ESTADO
            FROM read_parquet('${f.key}')
        `).join(' UNION ALL ');

        await this.conn.query(`CREATE OR REPLACE TABLE ${this.table} AS ${queries}`);
    }

    async query(sql) {
        let result = await this.conn.query(sql);
        return result.toArray().map(row => row.toJSON());
    }
}
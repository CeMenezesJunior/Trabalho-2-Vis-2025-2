
import { loadDb } from './config';

export class Votacoes {
    async init() {
        this.db = await loadDb();
        this.conn = await this.db.connect();

        this.siglasEstados = [
            'AC', 'AL', 'AP', 'AM', 'BA',
            'CE', 'DF', 'ES', 'GO', 'MA',
            'MT', 'MS', 'MG', 'PA', 'PB',
            'PR', 'PE', 'PI', 'RJ', 'RN',
            'RS', 'RO', 'RR', 'SC', 'SP',
            'SE', 'TO'
            ];

        this.table = 'votacoes_2022';
    }

    async loadVotacoes() {
        if (!this.db || !this.conn)
            throw new Error('Database not initialized. Please call init() first.');

        const files = [];
        let id = 0;
        for (let sigla of this.siglasEstados) {
            const sId = String(id).padStart(2, '0')
            const filename = `/f167a93453e74a92ae332513f3f90051-0.parquet`

            const url = `SG_UF=${sigla}/${filename}`
            const key = `Y2023M${sId}`


            try{
                const res = await fetch(url);
                if(!res.ok){
                    console.error(`Falha ao buscar ${url}: ${res.statusText}`)
                    id++;
                    continue;
                }

                await this.db.registerFileBuffer(key, new Uint8Array(await res.arrayBuffer()));
                files.push({key: key, sigla: sigla});
                console.log(`Registrado: ${key}`);
            }catch(e){
                console.error(`Erro no fetch de ${url}:`, e);
            }
            id++;
        }
        
        if(files.length == 0){
            console.error("Nenhum arquivo carregado");
            return;
        }

        const queries = files.map((file, idx) => `
            SELECT 
                NM_VOTAVEL as CANDIDATO,
                CAST(QT_VOTOS AS INT) as VOTOS,
                NR_TURNO as TURNO,
                '${file.sigla}' as ESTADO

            FROM read_parquet('${file.key}')
        `).join(' UNION ALL ');

        
        await this.conn.query(`
            CREATE OR REPLACE TABLE ${this.table} AS
            ${queries}
        `);
    }

    async query(sql) {
        if (!this.db || !this.conn)
            throw new Error('Database not initialized. Please call init() first.');

        let result = await this.conn.query(sql);
        return result.toArray().map(row => row.toJSON());
    }
}
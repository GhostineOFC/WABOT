// WABOT V3.1.6 — inicialização compatível com Node.js CommonJS e ESM.
(async () => {
    console.log('[WABOT 3.1.6] Arquivo index.js carregado. Preparando dependências...');

// WABOT V3.1.0 — mercado, guildas, chefes, PvP e missões

// Compatibilidade com hospedagens Node.js que executam index.js como CommonJS.
// As dependências são carregadas dinamicamente para não exigir "type": "module".
const __baileys = await import('@whiskeysockets/baileys');
const makeWASocket = __baileys.default;
const {
    DisconnectReason,
    useMultiFileAuthState,
    getAggregateVotesInPollMessage,
    downloadMediaMessage
} = __baileys;

const __qrcode = await import('qrcode-terminal');
const qrcode = __qrcode.default ?? __qrcode;
const __sharp = await import('sharp');
const sharp = __sharp.default ?? __sharp;
const { randomInt } = await import('node:crypto');
const { readFile, writeFile, readdir } = await import('node:fs/promises');
const path = (await import('node:path')).default;

// ==================================================
// WABOT V2.9.0
// ==================================================

const DIRETORIO = path.dirname(process.argv[1] || '.');

const PREFIXO = '!';
const VERSAO = '3.1.7';

const SESSAO = path.join(DIRETORIO, 'sessao');

const ARQUIVO_PONTOS = path.join(DIRETORIO, 'pontuacao-quiz.json');
const ARQUIVO_MENSAGENS = path.join(DIRETORIO, 'mensagens-bot.json');
const ARQUIVO_PERSONALIZACAO = path.join(DIRETORIO, 'personalizacao-perfil.json');
const ARQUIVO_PESCA = path.join(DIRETORIO, 'dados-pesca.json');
const ARQUIVO_ENTREVISTAS = path.join(DIRETORIO, 'entrevistas.json');
const ARQUIVO_WACOINS = path.join(DIRETORIO, 'wacoins.json');
const ARQUIVO_RPG = path.join(DIRETORIO, 'dados-rpg.json');
const ARQUIVO_SISTEMAS = path.join(DIRETORIO, 'dados-sistemas-v310.json');

const IMAGEM_HELP = path.join(DIRETORIO, 'midia', 'help.png');
const IMAGEM_RANKING = path.join(DIRETORIO, 'midia', 'ranking.png');
const IMAGEM_ON = path.join(DIRETORIO, 'midia', 'ON.png');
const IMAGEM_OFF = path.join(DIRETORIO, 'midia', 'OFF.png');
const IMAGEM_MANUTENCAO = path.join(DIRETORIO, 'midia', 'MANUTENCAO.png');
const PASTA_GIFS = path.join(DIRETORIO, 'midia', 'Gifs');

// Adicione seus números autorizados com DDI + DDD, somente dígitos.
// Exemplo fictício: '5511999999999'
const NUMEROS_ADM = ['554299070540'];
const FOTOS_RECENTES = new Map();
const LIMITE_FOTO_STICKER = 8 * 1024 * 1024;
let botAtivo = true;

const TEMPO_REACAO = 30_000;
const TEMPO_COOLDOWN_PESCA = 20_000;

let inicio = Date.now();
let iniciando = false;
let reconectando = false;
let timerReconexao = null;
let tentativasReconexao = 0;

const mensagensProcessadas = new Set();
const cacheNomesUsuarios = new Map();
const cacheNomesGrupos = new Map();
const TTL_NOMES_GRUPO = 5 * 60 * 1000;

const quizzesAtivos = new Map();
const anagramasAtivos = new Map();
const forcasAtivas = new Map();
const enquetes = new Map();
const entrevistasAtivas = new Map();
const jogosDaVelha = new Map();
const menusLojaPesca = new Map(); // menu numérico individual por usuário e conversa

const cooldownPesca = new Map();
const pescariasEmAndamento = new Set();

const pontuacaoQuiz = {};

let mensagensComando = {};
let personalizacaoPerfil = {};
let dadosPesca = {};
let historicoEntrevistas = {};
let carteirasWACoins = {};
let dadosRPG = {};
let sistemasV310 = { mercado: [], guildas: {}, membrosGuilda: {}, chefes: {}, desafiosPVP: {}, recompensasDiarias: {} };
let manutencaoAtiva = false;
let timerResetAgendado = null;
const gravacoesEmAndamento = new Map();
const filasMensagens = new Map();
const MAX_PROCESSAMENTOS_SIMULTANEOS = 3;
const MAX_FILA_POR_CONVERSA = 40;
const MAX_MENSAGENS_PENDENTES = 250;
let processamentosAtivos = 0;
let mensagensPendentes = 0;
let ultimoLogSaude = 0;


// ==================================================
// FUNÇÕES AUXILIARES E PERSISTÊNCIA
// ==================================================

function aleatorio(lista) {
    if (!Array.isArray(lista) || lista.length === 0) return null;
    return lista[randomInt(0, lista.length)];
}

function normalizar(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function escaparSVG(valor) {
    return String(valor ?? '').normalize('NFC').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
    })[caractere]);
}

async function salvarJSON(arquivo, dados) {
    // Serializa gravações por arquivo para evitar que duas operações se sobrescrevam.
    const anterior = gravacoesEmAndamento.get(arquivo) || Promise.resolve();
    const gravacao = anterior.catch(() => {}).then(() =>
        writeFile(arquivo, JSON.stringify(dados, null, 2), 'utf8')
    );
    gravacoesEmAndamento.set(arquivo, gravacao);
    try {
        await gravacao;
    } finally {
        if (gravacoesEmAndamento.get(arquivo) === gravacao) {
            gravacoesEmAndamento.delete(arquivo);
        }
    }
}

async function lerJSON(arquivo, padrao = {}) {
    try {
        const conteudo = await readFile(arquivo, 'utf8');
        return JSON.parse(conteudo);
    } catch (erro) {
        if (erro.code === 'ENOENT') return padrao;
        console.error(`[WABOT] Não foi possível ler ${path.basename(arquivo)}:`, erro.message);
        return padrao;
    }
}

const VALOR_PONTO_QUIZ = 10; // Conversão de pontos antigos; recompensas novas usam valores específicos
const TAXA_JUROS_BANCO = 0.005;
const INTERVALO_JUROS_MS = 60 * 60 * 1000;

function obterCarteira(id, nome = 'Jogador') {
    let chave = id;
    if (!carteirasWACoins[chave]) {
        const chaveExistente = Object.keys(carteirasWACoins).find(chaveSalva =>
            !chaveSalva.startsWith('__') && mesmoUsuario(chaveSalva, id)
        );
        if (chaveExistente) chave = chaveExistente;
    }
    if (!carteirasWACoins[chave] || typeof carteirasWACoins[chave] !== 'object') {
        carteirasWACoins[chave] = {
            nome,
            saldo: 0,
            banco: 0,
            ultimaAtualizacaoBanco: Date.now()
        };
    }
    const carteira = carteirasWACoins[chave];
    carteira.nome = nome || carteira.nome || nomeExibicao(id);
    carteira.saldo = Math.max(0, Number(carteira.saldo) || 0);
    carteira.banco = Math.max(0, Number(carteira.banco) || 0);
    carteira.ultimaAtualizacaoBanco = Number(carteira.ultimaAtualizacaoBanco) || Date.now();
    return carteira;
}

function obterNivelUsuario(id) {
    return calcularNivelPerfil(obterPontosQuiz(id)).nivel;
}

function obterTaxaBanco(id) {
    const nivel = Math.max(1, obterNivelUsuario(id));
    return TAXA_JUROS_BANCO + ((nivel - 1) * 0.0015);
}

function atualizarJurosBanco(carteira, id) {
    const agora = Date.now();
    const periodos = Math.floor((agora - carteira.ultimaAtualizacaoBanco) / INTERVALO_JUROS_MS);
    if (periodos > 0) {
        carteira.banco = Math.round((carteira.banco * Math.pow(1 + obterTaxaBanco(id), periodos) + 0.0000001) * 100) / 100;
        carteira.ultimaAtualizacaoBanco += periodos * INTERVALO_JUROS_MS;
    }
    return periodos;
}

async function salvarWACoins() {
    await salvarJSON(ARQUIVO_WACOINS, carteirasWACoins);
}

async function adicionarWACoins(id, nome, valor) {
    const carteira = obterCarteira(id, nome);
    carteira.saldo = Math.round((carteira.saldo + Number(valor || 0)) * 100) / 100;
    await salvarWACoins();
    return carteira.saldo;
}

function formatarWACoins(valor) {
    return `${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} WACoins`;
}

async function migrarEconomiaParaWACoins() {
    if (carteirasWACoins.__migracao_276_concluida) return;

    for (const [id, dados] of Object.entries(pontuacaoQuiz)) {
        const pontosAntigos = Math.max(0, Number(dados?.pontos) || 0);
        if (pontosAntigos > 0) {
            const carteira = obterCarteira(id, dados?.nome || id.split('@')[0]);
            carteira.saldo = Math.round((carteira.saldo + pontosAntigos * VALOR_PONTO_QUIZ) * 100) / 100;
        }
    }

    for (const [id, pescador] of Object.entries(dadosPesca)) {
        const moedasAntigas = Math.max(0, Number(pescador?.moedas) || 0);
        if (moedasAntigas > 0) {
            const carteira = obterCarteira(id, pescador?.nome || id.split('@')[0]);
            carteira.saldo = Math.round((carteira.saldo + moedasAntigas) * 100) / 100;
        }
        // Zera o saldo antigo para evitar duplicação; os dados de peixes/equipamentos ficam intactos.
        pescador.moedas = 0;
    }

    carteirasWACoins.__migracao_276_concluida = true;
    await Promise.all([salvarWACoins(), salvarJSON(ARQUIVO_PESCA, dadosPesca)]);
}

async function carregarDados() {
    const [pontos, mensagens, personalizacao, pesca, entrevistas, carteiras, rpg, sistemas] = await Promise.all([
        lerJSON(ARQUIVO_PONTOS),
        lerJSON(ARQUIVO_MENSAGENS),
        lerJSON(ARQUIVO_PERSONALIZACAO),
        lerJSON(ARQUIVO_PESCA),
        lerJSON(ARQUIVO_ENTREVISTAS),
        lerJSON(ARQUIVO_WACOINS),
        lerJSON(ARQUIVO_RPG),
        lerJSON(ARQUIVO_SISTEMAS, { mercado: [], guildas: {}, membrosGuilda: {}, chefes: {}, desafiosPVP: {}, recompensasDiarias: {} })
    ]);

    Object.assign(pontuacaoQuiz, pontos && typeof pontos === 'object' ? pontos : {});
    mensagensComando = mensagens && typeof mensagens === 'object' ? mensagens : {};
    personalizacaoPerfil = personalizacao && typeof personalizacao === 'object' ? personalizacao : {};
    dadosPesca = pesca && typeof pesca === 'object' ? pesca : {};

    // Peixes antigos já renderam WACoins no momento da captura.
    // Marca esses registros como pagos para impedir venda duplicada após a atualização.
    let migracaoPeixesAntigos = false;
    for (const pescador of Object.values(dadosPesca)) {
        if (!pescador || typeof pescador !== 'object') continue;
        if (!Array.isArray(pescador.peixes)) pescador.peixes = [];
        for (const peixe of pescador.peixes) {
            if (peixe && typeof peixe === 'object' && typeof peixe.pagoNaCaptura !== 'boolean') {
                peixe.pagoNaCaptura = true;
                migracaoPeixesAntigos = true;
            }
        }
    }

    historicoEntrevistas = entrevistas && typeof entrevistas === 'object' ? entrevistas : {};
    carteirasWACoins = carteiras && typeof carteiras === 'object' ? carteiras : {};
    dadosRPG = rpg && typeof rpg === 'object' ? rpg : {};
    sistemasV310 = sistemas && typeof sistemas === 'object' ? sistemas : { mercado: [], guildas: {}, membrosGuilda: {}, chefes: {}, desafiosPVP: {}, recompensasDiarias: {} };
    sistemasV310.mercado ||= []; sistemasV310.guildas ||= {}; sistemasV310.membrosGuilda ||= {}; sistemasV310.chefes ||= {}; sistemasV310.desafiosPVP ||= {}; sistemasV310.recompensasDiarias ||= {}; sistemasV310.resetAgendado ||= {}; sistemasV310.resetHistorico ||= [];
    await migrarEconomiaParaWACoins();
    if (migracaoPeixesAntigos) await salvarDadosPesca();
    manutencaoAtiva = Boolean(carteirasWACoins.__manutencao_ativa);
    for (const entrevista of Object.values(historicoEntrevistas)) {
        if (entrevista?.status === 'em_andamento' && entrevista.grupoJid) {
            entrevistasAtivas.set(entrevista.grupoJid, entrevista);
        }
    }
}

function mesmoUsuario(a, b) {
    if (!a || !b) return false;
    const limpar = valor => String(valor).split(':')[0].toLowerCase();
    const A = limpar(a);
    const B = limpar(b);
    if (A === B) return true;
    const numeroA = A.split('@')[0].replace(/\D/g, '');
    const numeroB = B.split('@')[0].replace(/\D/g, '');
    return Boolean(numeroA && numeroB && numeroA === numeroB);
}

function normalizarJidNome(valor) {
    return String(valor || '').trim().toLowerCase();
}

function registrarNomeUsuario(id, nome) {
    const nomeLimpo = String(nome || '').replace(/[\u0000-\u001f]/g, '').trim();
    if (!id || !nomeLimpo || /^\d{5,}$/.test(nomeLimpo)) return;
    const valor = { nome: nomeLimpo.slice(0, 60), atualizadoEm: Date.now() };
    cacheNomesUsuarios.set(normalizarJidNome(id), valor);
    const base = String(id).split(':')[0];
    if (base && base !== id) cacheNomesUsuarios.set(normalizarJidNome(base), valor);
    while (cacheNomesUsuarios.size > 2000) cacheNomesUsuarios.delete(cacheNomesUsuarios.keys().next().value);
}

function obterParticipante(msg) {
    return msg.key?.participant || msg.key?.participantAlt || msg.key?.remoteJid || '';
}

function obterNome(msg) {
    const nome = msg.pushName || msg.verifiedBizName || '';
    if (nome) {
        registrarNomeUsuario(obterParticipante(msg), nome);
        if (msg.key?.participantAlt) registrarNomeUsuario(msg.key.participantAlt, nome);
    }
    return String(nome || cacheNomesUsuarios.get(normalizarJidNome(obterParticipante(msg)))?.nome || 'Jogador');
}

function nomeExibicao(id, fallback = 'Jogador') {
    const chave = normalizarJidNome(id);
    const base = chave.split(':')[0];
    const cache = cacheNomesUsuarios.get(chave) || cacheNomesUsuarios.get(base);
    if (cache?.nome) return cache.nome;
    const registros = [
        carteirasWACoins?.[id]?.nome,
        pontuacaoQuiz?.[id]?.nome,
        dadosPesca?.[id]?.nome,
        dadosRPG?.[id]?.nome
    ];
    const salvo = registros.find(n => typeof n === 'string' && n.trim() && !/^\d{5,}$/.test(n.trim()));
    return salvo || fallback;
}

async function atualizarNomesDoGrupo(sock, grupoJid) {
    if (!grupoJid?.endsWith('@g.us')) return;
    const cache = cacheNomesGrupos.get(grupoJid);
    if (cache && Date.now() - cache.atualizadoEm < TTL_NOMES_GRUPO) return;
    try {
        const metadata = await sock.groupMetadata(grupoJid);
        for (const participante of metadata.participants || []) {
            const nome = participante.notify || participante.name || participante.verifiedName || participante.shortName;
            for (const id of [participante.id, participante.jid, participante.phoneNumber]) {
                if (id) registrarNomeUsuario(id, nome);
            }
        }
        cacheNomesGrupos.set(grupoJid, { atualizadoEm: Date.now() });
        while (cacheNomesGrupos.size > 300) cacheNomesGrupos.delete(cacheNomesGrupos.keys().next().value);
    } catch (erro) {
        console.warn('[NOMES] Não foi possível atualizar os nomes do grupo:', erro.message);
    }
}

function extrairTexto(message) {
    if (!message) return '';
    const m = message.ephemeralMessage?.message
        || message.viewOnceMessage?.message
        || message.viewOnceMessageV2?.message
        || message.documentWithCaptionMessage?.message
        || message;
    return m.conversation
        || m.extendedTextMessage?.text
        || m.imageMessage?.caption
        || m.videoMessage?.caption
        || m.documentMessage?.caption
        || m.buttonsResponseMessage?.selectedButtonId
        || m.listResponseMessage?.singleSelectReply?.selectedRowId
        || m.templateButtonReplyMessage?.selectedId
        || '';
}

function tempoLigado() {
    const total = Math.max(0, Date.now() - inicio);
    const segundos = Math.floor(total / 1000);
    const dias = Math.floor(segundos / 86400);
    const horas = Math.floor((segundos % 86400) / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const resto = segundos % 60;
    return `${dias}d ${horas}h ${minutos}m ${resto}s`;
}

async function registrarPonto(id, nome, pontos, recompensaWACoins = null) {
    if (!pontuacaoQuiz[id]) pontuacaoQuiz[id] = { nome, pontos: 0 };
    pontuacaoQuiz[id].nome = nome || pontuacaoQuiz[id].nome || id;
    const pontosGanhos = Number(pontos || 0);
    pontuacaoQuiz[id].pontos = Number(pontuacaoQuiz[id].pontos || 0) + pontosGanhos;
    await salvarJSON(ARQUIVO_PONTOS, pontuacaoQuiz);
    const recompensa = recompensaWACoins === null ? pontosGanhos * VALOR_PONTO_QUIZ : Math.max(0, Number(recompensaWACoins) || 0);
    await adicionarWACoins(id, nome, recompensa);
}

// ==================================================
// PERGUNTAS NORMAIS
// ==================================================

const perguntas = [
    { pergunta: 'Qual é o maior planeta do Sistema Solar?', resposta: 'jupiter' },
    { pergunta: 'Qual é o processo pelo qual as plantas produzem alimento?', resposta: 'fotossintese' },
    { pergunta: 'Qual é o símbolo químico do ouro?', resposta: 'au' },
    { pergunta: 'Qual é a estrela mais próxima da Terra?', resposta: 'sol' },
    { pergunta: 'Qual é a capital do Japão?', resposta: 'toquio' },
    { pergunta: 'Quantos minutos existem em uma hora?', resposta: '60' },
    { pergunta: 'Qual é o menor número primo?', resposta: '2' },
    { pergunta: 'Em qual continente fica o Egito?', resposta: 'africa' },
    { pergunta: 'Qual é o satélite natural da Terra?', resposta: 'lua' },
    { pergunta: 'Quanto é 144 dividido por 12?', resposta: '12' },
    { pergunta: 'Qual planeta é conhecido como planeta vermelho?', resposta: 'marte' },
    { pergunta: 'Quantos planetas existem no Sistema Solar?', resposta: '8' },
    { pergunta: 'Qual é a raiz quadrada de 81?', resposta: '9' },
    { pergunta: 'Qual país é famoso pela Torre Eiffel?', resposta: 'franca' },
    { pergunta: 'Qual linguagem de marcação estrutura páginas web?', resposta: 'html' },
    { pergunta: 'Quanto é 5 + 7?', resposta: '12' },
    { pergunta: 'Quanto é 9 vezes 3?', resposta: '27' },
    { pergunta: 'Quanto é 100 dividido por 4?', resposta: '25' },
    { pergunta: 'Quanto é 15 + 28?', resposta: '43' },
    { pergunta: 'Quanto é 50 - 17?', resposta: '33' },
    { pergunta: 'Quanto é 8 vezes 8?', resposta: '64' },
    { pergunta: 'Quanto é 10 ao quadrado?', resposta: '100' },
    { pergunta: 'Quanto é 25 + 75?', resposta: '100' },
    { pergunta: 'Quanto é 200 - 85?', resposta: '115' },
    { pergunta: 'Quanto é 12 vezes 5?', resposta: '60' },
    { pergunta: 'Quanto é 90 dividido por 10?', resposta: '9' },
    { pergunta: 'Quanto é 7 ao quadrado?', resposta: '49' },
    { pergunta: 'Quanto é 3 vezes 15?', resposta: '45' },
    { pergunta: 'Quanto é 250 + 250?', resposta: '500' },
    { pergunta: 'Quanto é 1000 dividido por 10?', resposta: '100' },
    { pergunta: 'Quanto é 11 vezes 11?', resposta: '121' },
    { pergunta: 'Quanto é 64 dividido por 8?', resposta: '8' },
    { pergunta: 'Quanto é 45 + 55?', resposta: '100' },
    { pergunta: 'Quanto é 6 vezes 7?', resposta: '42' },
    { pergunta: 'Quanto é 100 - 36?', resposta: '64' },
    { pergunta: 'Quantos lados tem um triângulo?', resposta: '3' },
    { pergunta: 'Quantos lados tem um quadrado?', resposta: '4' },
    { pergunta: 'Quanto é 36 dividido por 6?', resposta: '6' },
    { pergunta: 'Quanto é 14 vezes 2?', resposta: '28' },
    { pergunta: 'Quanto é 300 + 400?', resposta: '700' },
    { pergunta: 'Quanto é 1000 - 250?', resposta: '750' },
    { pergunta: 'Qual é a raiz quadrada de 100?', resposta: '10' },
    { pergunta: 'Quanto é 9 ao quadrado?', resposta: '81' },
    { pergunta: 'Quanto é 7 vezes 6?', resposta: '42' },
    { pergunta: 'Quanto é 80 dividido por 5?', resposta: '16' },
    { pergunta: 'Quanto é 125 + 125?', resposta: '250' },
    { pergunta: 'Quantos graus tem um ângulo reto?', resposta: '90' },
    { pergunta: 'Qual é o maior oceano da Terra?', resposta: 'pacifico' },
    { pergunta: 'Qual animal é conhecido como rei da selva?', resposta: 'leao' },
    { pergunta: 'Quantos dias tem um ano bissexto?', resposta: '366' },
    { pergunta: 'Qual é a capital do Brasil?', resposta: 'brasilia' },
    { pergunta: 'Qual instrumento mede a temperatura?', resposta: 'termometro' },
    { pergunta: 'Quanto é 18 dividido por 3?', resposta: '6' },
    { pergunta: 'Qual é o estado físico da água em forma de gelo?', resposta: 'solido' },
    { pergunta: 'Quantas cores tem o arco-íris tradicionalmente?', resposta: '7' },
    { pergunta: 'Qual é o idioma oficial do Brasil?', resposta: 'portugues' },
    { pergunta: 'Em qual planeta vivemos?', resposta: 'terra' },
    { pergunta: 'Qual é o maior mamífero do mundo?', resposta: 'baleia azul' },
    { pergunta: 'Quantos segundos tem um minuto?', resposta: '60' },
    { pergunta: 'Qual é o nome do processo em que a água vira vapor?', resposta: 'evaporacao' },
    { pergunta: 'Qual destes astros ilumina a Terra durante o dia?', resposta: 'sol' },
    { pergunta: 'Qual é o continente onde fica o Brasil?', resposta: 'america do sul' },
    { pergunta: 'Quantas patas tem uma aranha?', resposta: '8' },
    { pergunta: 'Qual é o resultado de 12 vezes 12?', resposta: '144' },
    { pergunta: 'Qual é o metal usado principalmente em latas de refrigerante?', resposta: 'aluminio' },
    { pergunta: 'Como se chama a mudança de sólido para líquido?', resposta: 'fusao' },
    { pergunta: 'Qual é o nome do satélite natural de Marte chamado Phobos em português?', resposta: 'fobos' }
];

// ==================================================
// PERGUNTAS HARD
// ==================================================

const perguntasHard = [
    { pergunta: 'Qual é o elemento químico de símbolo W?', resposta: 'tungstenio' },
    { pergunta: 'Qual civilização desenvolveu a escrita cuneiforme?', resposta: 'sumerios' },
    { pergunta: 'Qual é o maior deserto do mundo?', resposta: 'antartida' },
    { pergunta: 'Qual é o planeta com o dia mais longo do Sistema Solar?', resposta: 'venus' },
    { pergunta: 'Qual é o número atômico do ouro?', resposta: '79' },
    { pergunta: 'Qual cientista formulou as três leis do movimento?', resposta: 'isaac newton' },
    { pergunta: 'Qual é o gás mais abundante na atmosfera terrestre?', resposta: 'nitrogenio' },
    { pergunta: 'Qual é a unidade de medida da resistência elétrica?', resposta: 'ohm' },
    { pergunta: 'Qual é a galáxia mais próxima da Via Láctea entre as grandes galáxias?', resposta: 'andromeda' },
    { pergunta: 'Em que ano ocorreu a queda do Império Romano do Ocidente?', resposta: '476' },
    { pergunta: 'Qual era a capital do Império Bizantino?', resposta: 'constantinopla' },
    { pergunta: 'Qual país era conhecido antigamente como Pérsia?', resposta: 'ira' },
    { pergunta: 'Em qual continente está localizado o deserto de Gobi?', resposta: 'asia' },
    { pergunta: 'Qual é o resultado de 17 elevado ao quadrado?', resposta: '289' },
    { pergunta: 'Qual é o próximo número da sequência 2, 6, 12, 20, 30, 42?', resposta: '56' },
    { pergunta: 'Quantos lados possui um dodecágono?', resposta: '12' },
    { pergunta: 'Quanto é 2 elevado à décima potência?', resposta: '1024' },
    { pergunta: 'Qual é o nome da divisão celular que produz células reprodutivas?', resposta: 'meiose' },
    { pergunta: 'Qual é o osso mais longo do corpo humano?', resposta: 'femur' },
    { pergunta: 'Qual filósofo escreveu a obra A República?', resposta: 'platao' },
    { pergunta: 'Qual é o menor país do mundo em extensão territorial?', resposta: 'vaticano' },
    { pergunta: 'Qual é o metal que permanece líquido em temperatura ambiente?', resposta: 'mercurio' },
    { pergunta: 'Qual é a camada da atmosfera que contém a maior parte do ozônio?', resposta: 'estratosfera' },
    { pergunta: 'Qual é o valor aproximado da velocidade da luz no vácuo em km/s?', resposta: '299792' },
    { pergunta: 'Qual é a partícula subatômica que possui carga elétrica negativa?', resposta: 'eletron' },
    { pergunta: 'Qual é o nome do processo de transformação de vapor em líquido?', resposta: 'condensacao' },
    { pergunta: 'Qual é o maior órgão interno do corpo humano?', resposta: 'figado' },
    { pergunta: 'Quanto é 23 elevado ao quadrado?', resposta: '529' },
    { pergunta: 'Qual é a raiz quadrada de 2025?', resposta: '45' },
    { pergunta: 'Quanto é 15% de 840?', resposta: '126' },
    { pergunta: 'Qual é o resultado de 17 vezes 19?', resposta: '323' },
    { pergunta: 'Qual é a raiz cúbica de 729?', resposta: '9' },
    { pergunta: 'Quanto é 144 dividido por 0,12?', resposta: '1200' },
    { pergunta: 'Qual é o valor de fatorial de 6?', resposta: '720' },
    { pergunta: 'Quanto é 999 vezes 999?', resposta: '998001' },
    { pergunta: 'Qual é o mínimo múltiplo comum de 18 e 24?', resposta: '72' },
    { pergunta: 'Qual é o máximo divisor comum de 252 e 105?', resposta: '21' },
    { pergunta: 'Quanto é 7 elevado à quarta potência?', resposta: '2401' },
    { pergunta: 'Qual é a soma dos ângulos internos de um hexágono?', resposta: '720' },
    { pergunta: 'Quantas diagonais possui um decágono?', resposta: '35' },
    { pergunta: 'Qual é a raiz quadrada de 0,0081?', resposta: '0,09' },
    { pergunta: 'Quanto é 3 elevado à oitava potência?', resposta: '6561' },
    { pergunta: 'Qual é o valor de 25% de 760?', resposta: '190' },
    { pergunta: 'Quanto é 125 dividido por 0,25?', resposta: '500' },
    { pergunta: 'Qual é o próximo número da sequência 1, 4, 9, 16, 25, 36?', resposta: '49' },
    { pergunta: 'Quanto é 13 ao cubo?', resposta: '2197' },
    { pergunta: 'Qual é o valor de 10 fatorial?', resposta: '3628800' },
    { pergunta: 'Qual é a soma dos primeiros 100 números naturais positivos?', resposta: '5050' },
    { pergunta: 'Qual é o valor de 2 elevado à vigésima potência?', resposta: '1048576' },
    { pergunta: 'Quantos graus possui cada ângulo interno de um hexágono regular?', resposta: '120' },
    { pergunta: 'Qual é a raiz quarta de 625?', resposta: '5' },
    { pergunta: 'Quanto é 0,125 em forma de fração simplificada?', resposta: '1/8' },
    { pergunta: 'Qual é o resultado de 144 ao quadrado?', resposta: '20736' },
    { pergunta: 'Qual é o menor número primo maior que 100?', resposta: '101' },
    { pergunta: 'Quanto é 31 vezes 31?', resposta: '961' },
    { pergunta: 'Qual é a soma dos ângulos internos de um octógono?', resposta: '1080' },
    { pergunta: 'Quanto é 5 elevado à sexta potência?', resposta: '15625' },
    { pergunta: 'Qual é a raiz cúbica de 4096?', resposta: '16' },
    { pergunta: 'Quanto é 9999 mais 8888?', resposta: '18887' },
    { pergunta: 'Qual é o resultado de 7 fatorial?', resposta: '5040' },
    { pergunta: 'Quanto é 64 elevado à potência de 2?', resposta: '4096' },
    { pergunta: 'Qual é o valor de 2 elevado à décima quinta potência?', resposta: '32768' },
    { pergunta: 'Quantas diagonais possui um polígono de 12 lados?', resposta: '54' },
    { pergunta: 'Qual é o resultado de 15 ao cubo?', resposta: '3375' },
    { pergunta: 'Quanto é 1 dividido por 0,008?', resposta: '125' },
    { pergunta: 'Qual é a raiz quadrada de 998001?', resposta: '999' },
    { pergunta: 'Qual é o número atômico do carbono?', resposta: '6' },
    { pergunta: 'Qual matemático é associado ao último teorema que leva seu nome?', resposta: 'fermat' },
    { pergunta: 'Qual é o nome da escala que mede a acidez de uma solução?', resposta: 'ph' },
    { pergunta: 'Qual é a capital da Mongólia?', resposta: 'ulaanbaatar' },
    { pergunta: 'Qual tratado encerrou oficialmente a Primeira Guerra Mundial entre os Aliados e a Alemanha?', resposta: 'tratado de versalhes' },
    { pergunta: 'Qual é o valor de 12 fatorial?', resposta: '479001600' },
    { pergunta: 'Qual é o menor número perfeito?', resposta: '6' },
    { pergunta: 'Qual é o nome da camada mais externa da Terra?', resposta: 'crosta' },
    { pergunta: 'Qual é a unidade SI de frequência?', resposta: 'hertz' },
    { pergunta: 'Qual é o resultado de 2 elevado à décima potência menos 1?', resposta: '1023' },
    { pergunta: 'Qual país tem a cidade histórica de Petra?', resposta: 'jordania' },
    { pergunta: 'Qual é o nome do ponto da órbita em que um planeta está mais próximo do Sol?', resposta: 'periélio' },
    { pergunta: 'Qual é a fórmula química do ácido sulfúrico?', resposta: 'h2so4' },
    { pergunta: 'Quantos pares de cromossomos existem normalmente em uma célula somática humana?', resposta: '23' },
    { pergunta: 'Qual é o resultado de 7 elevado ao cubo?', resposta: '343' },
    { pergunta: 'Qual é o nome do processo pelo qual uma célula engloba partículas?', resposta: 'endocitose' },
    { pergunta: 'Qual filósofo grego foi mestre de Alexandre, o Grande?', resposta: 'aristoteles' },
    { pergunta: 'Qual é o valor decimal de 3/16?', resposta: '0,1875' },
    { pergunta: 'Qual é o nome da constante matemática aproximadamente igual a 2,71828?', resposta: 'e' },
    { pergunta: 'Em que ano foi assinado o Tratado de Tordesilhas?', resposta: '1494' }
];

// ==================================================
// OUTROS JOGOS
// ==================================================

const palavrasAnagrama = [
    'roblox', 'minecraft', 'computador', 'teclado',
    'monitor', 'programacao', 'javascript', 'dinossauro',
    'abacaxi', 'galaxia', 'astronauta', 'chocolate',
    'bicicleta', 'aventura', 'internet'
];

const palavrasForca = [
    'planeta', 'teclado', 'amizade', 'programa',
    'aventura', 'dinossauro', 'montanha', 'universo',
    'computador', 'chocolate', 'galaxia', 'biblioteca',
    'minecraft', 'roblox'
];

const frases = [
    'Pequenos projetos podem virar grandes ideias.',
    'Errar faz parte de aprender.',
    'Criatividade é experimentar possibilidades.',
    'Um passo de cada vez ainda é progresso.',
    'A melhor forma de aprender programação é praticando.',
    'Ideias ficam melhores quando saem do papel.',
    'Persistência é continuar aprendendo.'
];

// ==================================================
// SISTEMA DE PESCA
// ==================================================

const peixesDisponiveis = {
    comum: [
        { nome: 'Sardinha', valor: 5 },
        { nome: 'Lambari', valor: 7 },
        { nome: 'Tilápia', valor: 9 },
        { nome: 'Carpa', valor: 10 },
        { nome: 'Bagre', valor: 12 },
        { nome: 'Piranha', valor: 14 },
        { nome: 'Peixe-palhaço', valor: 11 },
        { nome: 'Pacu', valor: 13 },
        { nome: 'Corvina', valor: 15 },
        { nome: 'Peixe-agulha', valor: 16 },
        { nome: 'Manjuba', valor: 8 },
        { nome: 'Pescada', valor: 18 },
        { nome: 'Acará', valor: 12 },
        { nome: 'Jundiá', valor: 17 }
    ],

    incomum: [
        { nome: 'Dourado', valor: 25 },
        { nome: 'Pirarucu', valor: 30 },
        { nome: 'Truta', valor: 28 },
        { nome: 'Robalo', valor: 32 },
        { nome: 'Peixe-espada', valor: 35 },
        { nome: 'Tambaqui', valor: 38 },
        { nome: 'Salmão', valor: 40 },
        { nome: 'Garoupa', valor: 43 },
        { nome: 'Anchova', valor: 45 },
        { nome: 'Peixe-galo', valor: 48 },
        { nome: 'Pampo', valor: 42 },
        { nome: 'Pirarara', valor: 50 },
        { nome: 'Bicuda', valor: 46 }
    ],

    raro: [
        { nome: 'Atum-azul', valor: 65 },
        { nome: 'Peixe-leão', valor: 70 },
        { nome: 'Enguia-elétrica', valor: 75 },
        { nome: 'Peixe-lua', valor: 80 },
        { nome: 'Marlin-azul', valor: 95 },
        { nome: 'Peixe-serra', valor: 105 },
        { nome: 'Esturjão', valor: 115 },
        { nome: 'Cavala-rei', valor: 125 },
        { nome: 'Peixe-víbora', valor: 135 },
        { nome: 'Peixe-ogro', valor: 145 },
        { nome: 'Peixe-machado', valor: 120 },
        { nome: 'Tubarão-raposa', valor: 140 }
    ],

    epico: [
        { nome: 'Tubarão-martelo', valor: 150 },
        { nome: 'Peixe-dragão', valor: 175 },
        { nome: 'Arraia-gigante', valor: 190 },
        { nome: 'Polvo-gigante', valor: 200 },
        { nome: 'Lula-colossal', valor: 230 },
        { nome: 'Tubarão-branco', valor: 260 },
        { nome: 'Manta-negra', valor: 290 },
        { nome: 'Tubarão-duende', valor: 320 },
        { nome: 'Peixe-rei abissal', valor: 350 },
        { nome: 'Polvo de cristal', valor: 380 },
        { nome: 'Baleia-das-tormentas', valor: 420 }
    ],

    lendario: [
        { nome: 'Leviatã', valor: 500 },
        { nome: 'Dragão-marinho', valor: 600 },
        { nome: 'Kraken', valor: 750 },
        { nome: 'Peixe-dourado ancestral', valor: 1000 },
        { nome: 'Serpente abissal', valor: 1200 },
        { nome: 'Megalodonte ancestral', valor: 1500 },
        { nome: 'Baleia espectral', valor: 1800 },
        { nome: 'Tubarão fantasma', valor: 2000 },
        { nome: 'Enguia colossal', valor: 2300 },
        { nome: 'Imperador dos mares', valor: 2500 },
        { nome: 'Guardião das profundezas', valor: 3000 },
        { nome: 'Fênix aquática', valor: 3500 },
        { nome: 'Basilisco oceânico', valor: 3900 },
        { nome: 'Titã das marés', valor: 4300 },
        { nome: 'Oráculo abissal', valor: 4700 },
        { nome: 'Colosso das fossas', valor: 5200 },
        { nome: 'Imperatriz abissal', valor: 5800 },
        { nome: 'Cérbero marinho', valor: 6200 },
        { nome: 'Tritão primordial', valor: 7000 },
        { nome: 'A Serpente do Fim', valor: 9000 }
    ],

    divina: [
        { nome: 'Deus dos oceanos', valor: 5000 },
        { nome: 'Leviatã celestial', valor: 6500 },
        { nome: 'Serafim das águas', valor: 8000 },
        { nome: 'Dragão divino', valor: 10000 },
        { nome: 'Rei do oceano eterno', valor: 12500 },
        { nome: 'Devorador de mundos', valor: 15000 },
        { nome: 'Criador dos mares', valor: 20000 },
        { nome: 'Peixe primordial', valor: 25000 },
        { nome: 'Entidade do abismo', valor: 30000 },
        { nome: 'A Origem', valor: 50000 },
        { nome: 'Arquiteto do oceano', valor: 65000 },
        { nome: 'Eternidade azul', valor: 80000 },
        { nome: 'Coração do universo', valor: 100000 },
        { nome: 'Estrela dos oceanos', valor: 125000 },
        { nome: 'O Primeiro Peixe', valor: 150000 },
        { nome: 'Deus do abismo eterno', valor: 200000 },
        { nome: 'Núcleo da criação', valor: 300000 },
        { nome: 'O Infinito Azul', valor: 500000 }
    ]
};

const raridadesPesca = {
    comum: {
        nome: 'COMUM',
        emoji: '⚪'
    },
    incomum: {
        nome: 'INCOMUM',
        emoji: '🟢'
    },
    raro: {
        nome: 'RARO',
        emoji: '🔵'
    },
    epico: {
        nome: 'ÉPICO',
        emoji: '🟣'
    },
    lendario: {
        nome: 'LENDÁRIO',
        emoji: '🟡'
    },
    divina: {
        nome: 'DIVINO',
        emoji: '😇'
    }
};

function obterDadosPescador(id, nome) {
    if (!dadosPesca[id]) {
        dadosPesca[id] = {
            nome,
            moedas: 0,
            capturas: 0,
            maiorPeixe: 0,
            peixes: [],
            equipamentos: { vara: 'basica', isca: 'comum', amuleto: 0, anel: 0, relicario: 0, pingente: 0, acelerador: 0, peso: 0 }
        };
    }

    const jogador = dadosPesca[id];

    jogador.nome = nome || jogador.nome || nomeExibicao(id);
    jogador.moedas = Number(jogador.moedas || 0);
    jogador.capturas = Number(jogador.capturas || 0);
    jogador.maiorPeixe = Number(jogador.maiorPeixe || 0);

    if (!Array.isArray(jogador.peixes)) jogador.peixes = [];
    if (!Array.isArray(jogador.itensEvento)) jogador.itensEvento = [];
    jogador.bonusSorteEvento = Math.max(0, Math.min(5, Number(jogador.bonusSorteEvento) || 0));
    jogador.renascimentos = Math.max(0, Number(jogador.renascimentos) || 0);
    jogador.bonusSorteRenascimento = Math.max(0, Number(jogador.bonusSorteRenascimento) || 0);
    jogador.bonusPesoRenascimento = Math.max(0, Number(jogador.bonusPesoRenascimento) || 0);
    if (!jogador.equipamentos || typeof jogador.equipamentos !== 'object') {
        jogador.equipamentos = { vara: 'basica', isca: 'comum', amuleto: 0, anel: 0, relicario: 0, pingente: 0, acelerador: 0, peso: 0 };
    }
    jogador.equipamentos.vara ||= 'basica';
    jogador.equipamentos.isca ||= 'comum';
    jogador.equipamentos.linha = Math.max(0, Math.min(5, Number(jogador.equipamentos.linha) || 0));
    jogador.equipamentos.amuleto = Math.max(0, Math.min(3, Number(jogador.equipamentos.amuleto || 0)));
    for (const slot of ['anel', 'relicario', 'pingente', 'acelerador', 'peso']) {
        jogador.equipamentos[slot] = Math.max(0, Math.min(3, Number(jogador.equipamentos[slot] || 0)));
    }

    return jogador;
}

async function salvarDadosPesca() {
    await salvarJSON(ARQUIVO_PESCA, dadosPesca);
}

const LOJA_PESCA = {
    vara_pro: { tipo: 'vara', nome: 'Vara profissional', preco: 300, sorte: 1, nivel: 1 },
    vara_mistica: { tipo: 'vara', nome: 'Vara mística', preco: 1100, sorte: 2, nivel: 2 },
    vara_lendaria: { tipo: 'vara', nome: 'Vara lendária', preco: 3250, sorte: 3, nivel: 3 },
    isca_premium: { tipo: 'isca', nome: 'Isca premium', preco: 225, sorte: 1, nivel: 1 },
    isca_divina: { tipo: 'isca', nome: 'Isca divina', preco: 450, sorte: 2, nivel: 2 },
    isca_ancestral: { tipo: 'isca', nome: 'Isca ancestral', preco: 2600, sorte: 3, nivel: 3 },
    amuleto_1: { tipo: 'amuleto', nome: 'Amuleto da sorte I', preco: 450, sorte: 1, nivel: 1 },
    amuleto_2: { tipo: 'amuleto', nome: 'Amuleto da sorte II', preco: 1200, sorte: 2, nivel: 2 },
    amuleto_3: { tipo: 'amuleto', nome: 'Amuleto da sorte III', preco: 2500, sorte: 3, nivel: 3 },

    anel_1: { tipo: 'anel', nome: 'Anel da fortuna I', preco: 1750, sorte: 1, nivel: 1 },
    anel_2: { tipo: 'anel', nome: 'Anel da fortuna II', preco: 4000, sorte: 2, nivel: 2 },
    anel_3: { tipo: 'anel', nome: 'Anel da fortuna III', preco: 8000, sorte: 3, nivel: 3 },
    relicario_1: { tipo: 'relicario', nome: 'Relicário oceânico I', preco: 2500, sorte: 1, nivel: 1 },
    relicario_2: { tipo: 'relicario', nome: 'Relicário oceânico II', preco: 5500, sorte: 2, nivel: 2 },
    relicario_3: { tipo: 'relicario', nome: 'Relicário oceânico III', preco: 5500, sorte: 3, nivel: 3 },
    pingente_1: { tipo: 'pingente', nome: 'Pingente da maré I', preco: 3500, sorte: 1, nivel: 1 },
    pingente_2: { tipo: 'pingente', nome: 'Pingente da maré II', preco: 7500, sorte: 2, nivel: 2 },
    pingente_3: { tipo: 'pingente', nome: 'Pingente da maré III', preco: 7500, sorte: 3, nivel: 3 },

    acelerador_1: { tipo: 'acelerador', nome: 'Carretilha rápida I', preco: 450, nivel: 1 },
    acelerador_2: { tipo: 'acelerador', nome: 'Carretilha rápida II', preco: 2500, nivel: 2 },
    acelerador_3: { tipo: 'acelerador', nome: 'Carretilha turbo III', preco: 6000, nivel: 3 },
    peso_1: { tipo: 'peso', nome: 'Chumbo reforçado I', preco: 1100, nivel: 1 },
    peso_2: { tipo: 'peso', nome: 'Chumbo reforçado II', preco: 3250, nivel: 2 },
    peso_3: { tipo: 'peso', nome: 'Chumbo abissal III', preco: 7500, nivel: 3 },

    linha_1: { tipo: 'linha', nome: 'Linha reforçada I — 30 m', preco: 650, nivel: 1 },
    linha_2: { tipo: 'linha', nome: 'Linha oceânica II — 75 m', preco: 1800, nivel: 2 },
    linha_3: { tipo: 'linha', nome: 'Linha abissal III — 150 m', preco: 4200, nivel: 3 },
    linha_4: { tipo: 'linha', nome: 'Linha titânica IV — 300 m', preco: 9000, nivel: 4 },
    linha_5: { tipo: 'linha', nome: 'Linha do infinito V — 600 m', preco: 18000, nivel: 5 }
};

function calcularSortePesca(jogador, bonusEvento = 0) {
    const eq = jogador.equipamentos || {};
    const nivelVara = { basica: 0, profissional: 1, mistica: 2, lendaria: 3 };
    const nivelIsca = { comum: 0, premium: 1, divina: 2, ancestral: 3 };
    return (nivelVara[eq.vara] ?? 0)
        + (nivelIsca[eq.isca] ?? 0)
        + Math.max(0, Math.min(3, Number(eq.amuleto) || 0))
        + Math.max(0, Math.min(3, Number(eq.anel) || 0))
        + Math.max(0, Math.min(3, Number(eq.relicario) || 0))
        + Math.max(0, Math.min(3, Number(eq.pingente) || 0))
        + Math.max(0, Math.min(5, Number(jogador.bonusSorteEvento) || 0))
        + Math.max(0, Number(jogador.bonusSorteRenascimento) || 0)
        + Math.max(0, Number(bonusEvento) || 0);
}

function obterProfundidadeLinha(jogador) {
    const nivel = Math.max(0, Math.min(5, Number(jogador.equipamentos?.linha) || 0));
    return [10, 30, 75, 150, 300, 600][nivel];
}

function calcularChancesPesca(jogador, bonusEvento = 0) {
    const sorte = Math.min(25, calcularSortePesca(jogador, bonusEvento));
    const nivelLinha = Math.max(0, Math.min(5, Number(jogador.equipamentos?.linha) || 0));
    const pesos = [
        5500 - sorte * 150 - nivelLinha * 520,
        2500 + sorte * 35 - nivelLinha * 120,
        1200 + sorte * 45 + nivelLinha * 260,
        600 + sorte * 35 + nivelLinha * 210,
        180 + sorte * 25 + nivelLinha * 125,
        20 + sorte * 10 + nivelLinha * 45
    ].map(peso => Math.max(5, peso));
    const total = pesos.reduce((soma, peso) => soma + peso, 0);
    const percentuais = pesos.map(peso => (peso / total) * 100);
    return {
        sorte,
        pesos,
        percentuais,
        texto: percentuais.map(valor => `${valor.toFixed(2).replace('.', ',')}%`)
    };
}

function calcularChanceLixoPesca(jogador) {
    return Math.max(2, 8 - calcularSortePesca(jogador) * 0.33);
}

function sortearRaridadePesca(jogador, bonusEvento = 0) {
    const { pesos } = calcularChancesPesca(jogador, bonusEvento);
    let sorteio = randomInt(1, pesos.reduce((soma, peso) => soma + peso, 0) + 1);
    const raridades = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'divina'];
    for (let i = 0; i < pesos.length; i++) {
        sorteio -= pesos[i];
        if (sorteio <= 0) return raridades[i];
    }
    return 'divina';
}

function calcularReducaoTempoPesca(jogador) {
    const nivel = Math.max(0, Math.min(3, Number(jogador.equipamentos?.acelerador) || 0));
    return [0, 20, 35, 50][nivel];
}

function calcularBonusPesoPesca(jogador) {
    const nivel = Math.max(0, Math.min(3, Number(jogador.equipamentos?.peso) || 0));
    return [0, 0.20, 0.40, 0.65][nivel] + Math.max(0, Number(jogador.bonusPesoRenascimento) || 0);
}

function obterTempoCooldownPesca(jogador) {
    return Math.round(TEMPO_COOLDOWN_PESCA * (1 - calcularReducaoTempoPesca(jogador) / 100));
}

function montarLojaPesca(id, nome) {
    const jogador = obterDadosPescador(id, nome);
    const eq = jogador.equipamentos;
    const vara = eq.vara === 'lendaria' ? 'Vara lendária' : eq.vara === 'mistica' ? 'Vara mística' : eq.vara === 'profissional' ? 'Vara profissional' : 'Vara básica';
    const isca = eq.isca === 'ancestral' ? 'Isca ancestral' : eq.isca === 'divina' ? 'Isca divina' : eq.isca === 'premium' ? 'Isca premium' : 'Isca comum';
    const eventoAtivo = obterEventoPescaAtivo();
    const chances = calcularChancesPesca(jogador, eventoAtivo?.bonusSorte || 0);
    return `🎣 *LOJA DE PESCA*

💰 Seu saldo: *${formatarWACoins(obterCarteira(id, nome).saldo)}*

🧰 *EQUIPAMENTO ATUAL*
🎣 ${vara}
🪱 ${isca}
🍀 Amuleto: nível ${eq.amuleto}/3
💍 Anel da fortuna: nível ${eq.anel}/3
🌊 Relicário oceânico: nível ${eq.relicario}/3
🔱 Pingente da maré: nível ${eq.pingente}/3
⚡ Redução do tempo: ${calcularReducaoTempoPesca(jogador)}%
⚖️ Bônus de peso: +${Math.round(calcularBonusPesoPesca(jogador) * 100)}%
✨ *Sorte adicional: +${chances.sorte}/25*\n🧵 Linha: nível ${eq.linha || 0}/5 (${obterProfundidadeLinha(jogador)} m)\n🎟️ Bônus permanente de evento: +${Number(jogador.bonusSorteEvento || 0)}/5\n${eventoAtivo ? `${eventoAtivo.emoji} Evento: ${eventoAtivo.nome} (+${eventoAtivo.bonusSorte} sorte)` : '🎟️ Nenhum evento de pesca ativo'}

📊 *CHANCES DE CAPTURA*
⚪ Comum: ${chances.texto[0]}
🟢 Incomum: ${chances.texto[1]}
🔵 Raro: ${chances.texto[2]}
🟣 Épico: ${chances.texto[3]}
🟡 Lendário: ${chances.texto[4]}
😇 Divino: ${chances.texto[5]}
🗑️ Chance de lixo: ${calcularChanceLixoPesca(jogador).toFixed(1).replace('.', ',')}%

🛒 *ITENS DE SORTE*
*vara_pro* — Vara profissional (+1 sorte) — 300 WACoins
*vara_mistica* — Vara mística (+2 sorte) — 1.100 WACoins
*vara_lendaria* — Vara lendária (+3 sorte) — 3.250 WACoins
*isca_premium* — Isca premium (+1 sorte) — 225 WACoins
*isca_divina* — Isca divina (+2 sorte) — 900 WACoins
*isca_ancestral* — Isca ancestral (+3 sorte) — 2.600 WACoins
*amuleto_1 / amuleto_2 / amuleto_3* — Amuleto da sorte (+1 a +3) — 450 a 2.500 WACoins
*anel_1 / anel_2 / anel_3* — Anel da fortuna (+1 a +3) — 1.750 a 8.000 WACoins
*relicario_1 / relicario_2 / relicario_3* — Relicário oceânico (+1 a +3) — 2.500 a 11.000 WACoins
*pingente_1 / pingente_2 / pingente_3* — Pingente da maré (+1 a +3) — 3.500 a 12.500 WACoins

🛒 *ITENS DE VELOCIDADE*
*acelerador_1* — Carretilha rápida I (20% mais rápido) — 900 WACoins
*acelerador_2* — Carretilha rápida II (35% mais rápido) — 2.500 WACoins
*acelerador_3* — Carretilha turbo III (50% mais rápido) — 6.000 WACoins

⚖️ *ITENS DE PESO*
*peso_1* — Chumbo reforçado I (+20% peso) — 1.100 WACoins
*peso_2* — Chumbo reforçado II (+40% peso) — 3.250 WACoins
*peso_3* — Chumbo abissal III (+65% peso) — 12.500 WACoins

🧵 LINHAS: nível 0–5, até 600 m. Linhas maiores liberam peixes exclusivos, aumentam as chances de raridades altas e o peso das capturas.\\n\\nCompre com: *!comprarpesca ID (ou escolha um número na loja)*
Exemplo: !comprarpesca acelerador_1`;
}

async function comprarItemPesca(sock, jid, id, nome, itemId) {
    const item = LOJA_PESCA[itemId];
    if (!item) return texto(sock, jid, '❌ Item não encontrado. Use !lojapesca para ver a loja.');
    const jogador = obterDadosPescador(id, nome);
    const eq = jogador.equipamentos;
    const nivelAtual = item.tipo === 'vara'
        ? ({ basica: 0, profissional: 1, mistica: 2, lendaria: 3 }[eq.vara] ?? 0)
        : item.tipo === 'isca'
            ? ({ comum: 0, premium: 1, divina: 2, ancestral: 3 }[eq.isca] ?? 0)
            : Number(eq[item.tipo] || 0);

    if (item.nivel <= nivelAtual) {
        return texto(sock, jid, '⚠️ Você já possui esse nível ou um nível superior desse equipamento.');
    }
    const carteira = obterCarteira(id, nome);
    if (carteira.saldo < item.preco) {
        return texto(sock, jid, `❌ Saldo insuficiente. Você tem ${formatarWACoins(carteira.saldo)} e precisa de ${formatarWACoins(item.preco)}.`);
    }

    carteira.saldo -= item.preco;
    if (item.tipo === 'vara') eq.vara = ['basica', 'profissional', 'mistica', 'lendaria'][item.nivel];
    else if (item.tipo === 'isca') eq.isca = ['comum', 'premium', 'divina', 'ancestral'][item.nivel];
    else eq[item.tipo] = item.nivel;

    await Promise.all([salvarDadosPesca(), salvarWACoins()]);
    return texto(sock, jid, `✅ *COMPRA REALIZADA!*

${item.nome}
💸 Pago: ${formatarWACoins(item.preco)}
💰 Saldo restante: ${formatarWACoins(carteira.saldo)}

✨ Sorte adicional: +${calcularSortePesca(jogador)}/25
⚡ Redução do tempo: ${calcularReducaoTempoPesca(jogador)}%
⚖️ Bônus de peso: +${Math.round(calcularBonusPesoPesca(jogador) * 100)}%${item.tipo === 'linha' ? `\n🧵 Profundidade máxima: ${obterProfundidadeLinha(jogador)} m` : ''}`);
}

function formatarPeso(peso) {
    return peso >= 1000
        ? `${(peso / 1000).toFixed(2).replace('.', ',')} kg`
        : `${peso} g`;
}

function calcularPesoPesca(raridade) {
    const faixas = {
        comum: [10, 500],
        incomum: [100, 1500],
        raro: [300, 4000],
        epico: [1000, 12000],
        lendario: [5000, 50000],
        divina: [10000, 100000]
    };

    const [minimo, maximo] = faixas[raridade];

    return randomInt(minimo, maximo + 1);
}


function obterEventoPescaAtivo() {
    const evento = carteirasWACoins.__evento_pesca;
    if (!evento || !evento.terminaEm || Date.now() >= evento.terminaEm) {
        if (evento) {
            delete carteirasWACoins.__evento_pesca;
            salvarWACoins().catch(() => {});
        }
        return null;
    }
    return evento;
}

const PEIXES_EVENTO_PESCA = {
    taco: [
        { nome: 'Peixe-Tortilha', raridade: 'raro', valor: 700 },
        { nome: 'Tubarão-Taco', raridade: 'epico', valor: 1800 },
        { nome: 'Rei Taco dos Sete Mares', raridade: 'lendario', valor: 7500 }
    ],
    mare: [
        { nome: 'Tubarão-Taco', raridade: 'epico', valor: 850 },
        { nome: 'Atum da Maré Azul', raridade: 'lendario', valor: 2600 },
        { nome: 'Guardião do Festival', raridade: 'divina', valor: 18000 }
    ],
    estrelas: [
        { nome: 'Carpa Estelar', raridade: 'raro', valor: 650 },
        { nome: 'Enguia Celeste', raridade: 'epico', valor: 1500 },
        { nome: 'Cometa dos Oceanos', raridade: 'lendario', valor: 6500 }
    ],
    abismo: [
        { nome: 'Lula das Sombras', raridade: 'epico', valor: 1200 },
        { nome: 'Leviatã Corrompido', raridade: 'lendario', valor: 8000 },
        { nome: 'Coração do Abismo', raridade: 'divina', valor: 25000 }
    ]
};

function formatarTempoEvento(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const segundos = total % 60;
    return [horas ? `${horas}h` : '', minutos ? `${minutos}min` : '', `${segundos}s`].filter(Boolean).join(' ');
}

function criarEventoPesca(tipo, duracaoMinutos, bonusSorte) {
    const tipos = {
        taco: { nome: 'Festival do Taco', emoji: '🌮' },
        mare: { nome: 'Festival da Maré', emoji: '🌊' },
        estrelas: { nome: 'Chuva de Estrelas', emoji: '🌠' },
        abismo: { nome: 'Despertar do Abismo', emoji: '🕳️' }
    };
    const modelo = tipos[normalizar(tipo)] || tipos.mare;
    const chave = tipos[normalizar(tipo)] ? normalizar(tipo) : 'mare';
    const minutos = Math.max(5, Math.min(1440, Number(duracaoMinutos) || 30));
    const sorte = Math.max(1, Math.min(10, Number(bonusSorte) || 3));
    return {
        tipo: chave,
        nome: modelo.nome,
        emoji: modelo.emoji,
        bonusSorte: sorte,
        iniciadoEm: Date.now(),
        terminaEm: Date.now() + minutos * 60 * 1000
    };
}


const PEIXES_PROFUNDIDADE = {
    2: {
        raro: [{ nome: 'Peixe-lanterna', valor: 190 }, { nome: 'Quimera-marinha', valor: 220 }],
        epico: [{ nome: 'Lula-fantasma', valor: 520 }]
    },
    3: {
        raro: [{ nome: 'Peixe-dragão-negro', valor: 320 }],
        epico: [{ nome: 'Aranha-do-mar-gigante', valor: 750 }, { nome: 'Enguia-de-cristal', valor: 900 }],
        lendario: [{ nome: 'Guardião da Fenda', valor: 5200 }]
    },
    4: {
        epico: [{ nome: 'Baleia do Silêncio', valor: 1800 }],
        lendario: [{ nome: 'Serpente da Trincheira', valor: 12000 }],
        divina: [{ nome: 'Olho do Abismo', valor: 90000 }]
    },
    5: {
        lendario: [{ nome: 'Colosso do Vazio', valor: 28000 }],
        divina: [{ nome: 'O Último Habitante', valor: 250000 }, { nome: 'Deus Adormecido', valor: 400000 }]
    }
};

function sortearPeixe(raridade, nivelLinha = 0) {
    const profundidade = Math.max(0, Math.min(5, Number(nivelLinha) || 0));
    const extras = [];
    for (let nivel = 2; nivel <= profundidade; nivel++) {
        const lista = PEIXES_PROFUNDIDADE[nivel]?.[raridade] || [];
        extras.push(...lista);
    }
    return aleatorio([...(peixesDisponiveis[raridade] || []), ...extras]);
}

function obterTempoRestantePesca(id, jogador) {
    const ultimo = cooldownPesca.get(id);

    if (!ultimo) return 0;

    const cooldown = jogador ? obterTempoCooldownPesca(jogador) : TEMPO_COOLDOWN_PESCA;
    const restante = cooldown - (Date.now() - ultimo);

    return Math.max(0, restante);
}

async function pescar(sock, jid, id, nome) {
    if (pescariasEmAndamento.has(id)) {
        await texto(sock, jid, '🎣 Você já está pescando. Aguarde o resultado!');
        return;
    }

    const jogadorAtual = obterDadosPescador(id, nome);
    const restante = obterTempoRestantePesca(id, jogadorAtual);

    if (restante > 0) {
        await texto(
            sock,
            jid,
            `⏳ Sua vara ainda está descansando!\n\nTente novamente em ${Math.ceil(restante / 1000)} segundo(s).`
        );
        return;
    }

    pescariasEmAndamento.add(id);
    cooldownPesca.set(id, Date.now());

    try {
        await texto(
            sock,
            jid,
            `🎣 *${nome.toUpperCase()} FOI PESCAR!*\n\nVocê lançou a linha...\n\n🌊 Aguardando alguma coisa morder a isca...`
        );

        await new Promise(resolve => setTimeout(resolve, 1800));

        const jogador = obterDadosPescador(id, nome);

        if (randomInt(1, 10001) <= Math.round(calcularChanceLixoPesca(jogador) * 100)) {
            const lixo = aleatorio([
                'Uma bota velha',
                'Uma lata amassada',
                'Um pneu perdido',
                'Uma garrafa vazia',
                'Um pedaço de madeira'
            ]);

            jogador.capturas++;

            await salvarDadosPesca();

            await texto(
                sock,
                jid,
                `🗑️ *PESCARIA ESTRANHA!*\n\n${nome}, você pescou:\n\n*${lixo}*\n\nPelo menos tentou! Na próxima pode vir algo melhor.`
            );

            return;
        }

        const evento = obterEventoPescaAtivo();
        const raridadeBase = sortearRaridadePesca(jogador, evento?.bonusSorte || 0);
        const peixesEvento = evento ? (PEIXES_EVENTO_PESCA[evento.tipo] || PEIXES_EVENTO_PESCA.mare) : [];
        const capturaEvento = evento && randomInt(1, 101) <= 12;
        const peixeEvento = capturaEvento ? aleatorio(peixesEvento) : null;
        const raridade = peixeEvento?.raridade || raridadeBase;
        const peixe = peixeEvento || sortearPeixe(raridade, jogador.equipamentos.linha);
        const pesoBase = calcularPesoPesca(raridade);
        const bonusProfundidade = 1 + (Math.max(0, Number(jogador.equipamentos.linha) || 0) * 0.12);
        const peso = Math.round(pesoBase * bonusProfundidade * (1 + calcularBonusPesoPesca(jogador)));

        const bonusPeso = Math.floor(peso / 100);
        const moedasGanhas = peixe.valor + bonusPeso;

        const captura = {
            nome: peixe.nome,
            raridade,
            peso,
            valor: moedasGanhas,
            pagoNaCaptura: false,
            exclusivoEvento: Boolean(peixeEvento),
            evento: peixeEvento ? evento.nome : null,
            data: Date.now()
        };

        jogador.peixes.push(captura);
        jogador.capturas++;
        let itemEventoRecebido = null;
        if (evento && randomInt(1, 101) <= 18) {
            const catalogoItensEvento = {
                taco: { nome: 'Amuleto Taco', bonusSorte: 1 },
                mare: { nome: 'Amuleto da Maré', bonusSorte: 1 },
                estrelas: { nome: 'Fragmento Estelar', bonusSorte: 1 },
                abismo: { nome: 'Relíquia Abissal', bonusSorte: 1 }
            };
            itemEventoRecebido = { ...(catalogoItensEvento[evento.tipo] || catalogoItensEvento.mare), data: Date.now() };
            jogador.itensEvento ||= [];
            jogador.itensEvento.push(itemEventoRecebido);
            jogador.bonusSorteEvento = Math.min(5, (Number(jogador.bonusSorteEvento) || 0) + itemEventoRecebido.bonusSorte);
        }
        // O peixe agora entra no inventário sem pagamento imediato.
        // O jogador recebe o valor ao vender com !venderpeixes.

        if (peso > jogador.maiorPeixe) {
            jogador.maiorPeixe = peso;
        }

        await salvarDadosPesca();

        const infoRaridade = raridadesPesca[raridade];

        let mensagemExtra = '';

        if (raridade === 'divina') {
            mensagemExtra = '\n\n😇 *CAPTURA DIVINA! VOCÊ CONSEGUIU ALGO EXTREMAMENTE RARO!*';
        } else if (raridade === 'lendario') {
            mensagemExtra = '\n\n🌟 *CAPTURA LENDÁRIA! QUE SORTE ABSURDA!*';
        } else if (raridade === 'epico') {
            mensagemExtra = '\n\n🔥 *CAPTURA ÉPICA! INCRÍVEL!*';
        } else if (raridade === 'raro') {
            mensagemExtra = '\n\n✨ *Uma captura rara!*';
        }

        await texto(
            sock,
            jid,
            `🎣 *PESCARIA CONCLUÍDA!*

👤 Pescador: ${nome}

${infoRaridade.emoji} Raridade: *${infoRaridade.nome}*
🐟 Peixe: *${peixe.nome}*
🌊 Profundidade alcançada: *${obterProfundidadeLinha(jogador)} m*
⚖️ Peso: *${formatarPeso(peso)}*

💵 Valor estimado para venda: *${formatarWACoins(moedasGanhas)}*

Use *!venderpeixes* para vender todos os peixes disponíveis ou *!venderpeixes ${raridade}* para vender por raridade.

📦 Total de capturas: ${jogador.capturas}${peixeEvento ? `\n🎟️ Peixe exclusivo do evento: ${evento.nome}` : ''}${itemEventoRecebido ? `\n🎁 Item de evento obtido: ${itemEventoRecebido.nome} (+1 sorte permanente)` : ''}${evento ? `\n🍀 Evento ativo: ${evento.nome} (+${evento.bonusSorte} sorte temporária)\n✨ Bônus permanente de sorte: +${Number(jogador.bonusSorteEvento || 0)}/5` : ''}${mensagemExtra}`
        );
    } catch (erro) {
        console.error('[PESCA] Erro:', erro);

        await texto(sock, jid, '❌ Ocorreu um erro durante a pescaria. Tente novamente.');
    } finally {
        pescariasEmAndamento.delete(id);
    }
}

function montarColecaoPesca(id, nome) {
    const jogador = obterDadosPescador(id, nome);

    if (!jogador.peixes.length) {
        const itensEvento = jogador.itensEvento?.length
            ? `\n\n🎁 *ITENS DE EVENTO*\n${jogador.itensEvento.map(item => `• ${item.nome}`).join('\n')}\n🍀 Bônus permanente de sorte: +${jogador.bonusSorteEvento}/5`
            : '';
        return `🎣 *COLEÇÃO DE ${jogador.nome.toUpperCase()}*\n\nVocê ainda não capturou nenhum peixe.\n\nUse !pescar para começar!${itensEvento}`;
    }

    const contagem = {};

    for (const peixe of jogador.peixes) {
        contagem[peixe.nome] = (contagem[peixe.nome] || 0) + 1;
    }

    const lista = Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])
        .map(([nomePeixe, quantidade]) =>
            `🐟 ${nomePeixe} — ${quantidade}x`
        )
        .join('\n');

    const lendarios = jogador.peixes.filter(
        peixe => peixe.raridade === 'lendario'
    ).length;

    const divinos = jogador.peixes.filter(
        peixe => peixe.raridade === 'divina'
    ).length;
    const disponiveisVenda = jogador.peixes.filter(peixe => peixe?.pagoNaCaptura === false);
    const valorDisponivel = disponiveisVenda.reduce((soma, peixe) => soma + Math.max(0, Number(peixe.valor) || 0), 0);

    return `🎣 *COLEÇÃO DE ${jogador.nome.toUpperCase()}*

${lista}

━━━━━━━━━━━━━━━━

📦 Capturas totais: ${jogador.capturas}
🪙 WACoins: ${formatarWACoins(obterCarteira(id, jogador.nome).saldo)}
💵 Peixes à venda: ${disponiveisVenda.length} (${formatarWACoins(valorDisponivel)})
⚖️ Maior peixe: ${formatarPeso(jogador.maiorPeixe)}
🌟 Lendários: ${lendarios}
😇 Divinos: ${divinos}
🍀 Bônus permanente de sorte: +${jogador.bonusSorteEvento}/5
🎁 Itens de evento: ${jogador.itensEvento.length ? jogador.itensEvento.map(item => item.nome).join(', ') : 'Nenhum'}

Use !venderpeixes para vender todos os disponíveis.`;
}

async function venderPeixes(sock, jid, id, nome, filtro = '') {
    const jogador = obterDadosPescador(id, nome);
    const filtroNormalizado = normalizar(filtro);
    const disponiveis = jogador.peixes.filter(peixe =>
        peixe && typeof peixe === 'object' && peixe.pagoNaCaptura !== true
    );

    if (!disponiveis.length) {
        return texto(sock, jid,
            '📦 Você não tem peixes disponíveis para venda.\n\nPeixes capturados antes da V2.8.4 já foram pagos no momento da captura e não podem ser vendidos novamente.');
    }

    let selecionados = disponiveis;
    if (filtroNormalizado) {
        const raridades = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'divina'];
        if (raridades.includes(filtroNormalizado)) {
            selecionados = disponiveis.filter(peixe => normalizar(peixe.raridade) === filtroNormalizado);
        } else {
            selecionados = disponiveis.filter(peixe => normalizar(peixe.nome) === filtroNormalizado);
        }
    }

    if (!selecionados.length) {
        return texto(sock, jid,
            `❌ Não encontrei peixes disponíveis correspondentes a "${filtro}".\nUse !peixes para consultar sua coleção.`);
    }

    const total = selecionados.reduce((soma, peixe) =>
        soma + Math.max(0, Math.floor(Number(peixe.valor) || 0)), 0);

    if (total <= 0) {
        return texto(sock, jid, '❌ O valor dos peixes selecionados é inválido. Nenhuma venda foi realizada.');
    }

    const idsVendidos = new Set(selecionados);
    jogador.peixes = jogador.peixes.filter(peixe => !idsVendidos.has(peixe));
    const saldo = await adicionarWACoins(id, nome, total);
    await salvarDadosPesca();

    const resumo = selecionados.slice(0, 8).map(peixe =>
        `• ${peixe.nome} (${raridadesPesca[peixe.raridade]?.nome || peixe.raridade || 'SEM RARIDADE'}) — ${formatarWACoins(peixe.valor)}`
    ).join('\n');
    const extra = selecionados.length > 8 ? `\n• e mais ${selecionados.length - 8} peixe(s)` : '';

    return texto(sock, jid,
        `💰 *VENDA CONCLUÍDA!*\n\n${resumo}${extra}\n\n🐟 Peixes vendidos: ${selecionados.length}\n🪙 Total recebido: *${formatarWACoins(total)}*\n💳 Saldo atual: *${formatarWACoins(saldo)}*`);
}

function montarRankingPesca() {
    const ranking = Object.entries(dadosPesca)
        .sort((a, b) => {
            const capturasA = Number(a[1].capturas || 0);
            const capturasB = Number(b[1].capturas || 0);

            if (capturasB !== capturasA) {
                return capturasB - capturasA;
            }

            return obterCarteira(b[0], b[1].nome).saldo - obterCarteira(a[0], a[1].nome).saldo;
        })
        .slice(0, 10);

    if (!ranking.length) {
        return 'Ainda não existem pescadores registrados.';
    }

    return ranking.map(([id, jogador], index) => {
        const posicao = index + 1;

        const medalhas = ['🥇', '🥈', '🥉'];
        const medalha = medalhas[index] || `${posicao}º`;

        return `${medalha} ${jogador.nome || nomeExibicao(id)}\n   🎣 ${jogador.capturas || 0} capturas • 🪙 ${formatarWACoins(obterCarteira(id, jogador.nome).saldo)}`;
    }).join('\n\n');
}

async function gerarImagemRankingPesca() {
    const ranking = Object.entries(dadosPesca)
        .sort((a, b) => Number(b[1].capturas || 0) - Number(a[1].capturas || 0) || obterCarteira(b[0], b[1].nome).saldo - obterCarteira(a[0], a[1].nome).saldo)
        .slice(0, 10);
    const linhas = ranking.map(([id, jogador], index) => {
        const y = 310 + index * 65;
        const medalha = ['#FFD45A', '#C8D2E5', '#D99A70'][index] || '#65739A';
        const nome = escaparSVG(String(jogador.nome || nomeExibicao(id)).slice(0, 22));
        return `<rect x="65" y="${y-39}" width="894" height="53" rx="15" fill="#152B50" stroke="#2C5278" stroke-width="1"/>
        <circle cx="100" cy="${y-13}" r="18" fill="${medalha}"/><text x="100" y="${y-6}" text-anchor="middle" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="18" font-weight="bold" fill="#10213D">${index+1}</text>
        <text x="137" y="${y-5}" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="23" font-weight="bold" fill="#F4F8FF">${nome}</text>
        <text x="925" y="${y-5}" text-anchor="end" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="18" font-weight="bold" fill="#72E4D1">${Number(jogador.capturas||0)} capt.  •  ${formatarWACoins(obterCarteira(id, jogador.nome).saldo)}</text>`;
    }).join('');
    const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#071629"/><stop offset="55%" stop-color="#103D5B"/><stop offset="100%" stop-color="#071A31"/></linearGradient>
      <linearGradient id="accent"><stop offset="0%" stop-color="#57E0D0"/><stop offset="100%" stop-color="#3C9BFF"/></linearGradient></defs>
      <rect width="1024" height="1024" fill="url(#bg)"/><circle cx="900" cy="100" r="230" fill="#55D9D0" opacity=".07"/><circle cx="70" cy="950" r="250" fill="#398BFF" opacity=".08"/>
      <rect x="48" y="42" width="928" height="925" rx="32" fill="#0A2039" stroke="#2A6680" stroke-width="2"/>
      <rect x="78" y="75" width="8" height="105" rx="4" fill="url(#accent)"/>
      <text x="108" y="112" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="22" font-weight="bold" letter-spacing="5" fill="#70E5D6">WABOT • OCEANO</text>
      <text x="108" y="166" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="46" font-weight="bold" fill="#FFFFFF">RANKING DE PESCA</text>
      <text x="108" y="211" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="18" fill="#A9C6D8">OS 10 PESCADORES COM MAIS CAPTURAS</text>
      ${linhas || '<text x="512" y="520" text-anchor="middle" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="28" fill="#FFFFFF">Nenhum pescador registrado</text>'}
      <text x="512" y="925" text-anchor="middle" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="15" letter-spacing="3" fill="#78A9C0">PESQUE • COLECIONE • EVOLUA</text>
    </svg>`;
    return sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

function obterPersonalizacao(id) {
    if (!id) throw new Error('ID do usuário não informado.');

    if (!personalizacaoPerfil[id] || typeof personalizacaoPerfil[id] !== 'object') {
        personalizacaoPerfil[id] = {};
    }

    const perfil = personalizacaoPerfil[id];
    if (!Array.isArray(perfil.inventario)) perfil.inventario = [];
    if (typeof perfil.bio !== 'string') perfil.bio = '';
    if (typeof perfil.status !== 'string') perfil.status = '';
    if (!perfil.equipado || typeof perfil.equipado !== 'object') {
        perfil.equipado = {
            moldura: null,
            corNome: '#FFE400',
            titulo: null,
            fundo: 'padrao'
        };
    }

    return perfil;
}

async function salvarPersonalizacao(id) {
    if (!id) return;

    await salvarJSON(
        ARQUIVO_PERSONALIZACAO,
        personalizacaoPerfil
    );
}

async function adicionarItemInventario(id, item) {
    const perfil = obterPersonalizacao(id);

    if (!perfil.inventario.includes(item)) {
        perfil.inventario.push(item);
        await salvarPersonalizacao(id);
    }
}

async function equiparPersonalizacao(id, categoria, item) {
    const perfil = obterPersonalizacao(id);

    const categoriasPermitidas = [
        'moldura',
        'corNome',
        'titulo',
        'fundo'
    ];

    if (!categoriasPermitidas.includes(categoria)) {
        throw new Error('Categoria de personalização inválida.');
    }

    perfil.equipado[categoria] = item;

    await salvarPersonalizacao(id);
}


// ==================================================
// LOJA DE PERSONALIZAÇÃO DO PERFIL
// ==================================================

const ITENS_PERFIL = {
    moldura_azul: {
        categoria: 'moldura', nome: 'Moldura Azul', preco: 350,
        valor: '#38BDF8', descricao: 'Borda azul para o avatar.'
    },
    moldura_roxa: {
        categoria: 'moldura', nome: 'Moldura Roxa', preco: 650,
        valor: '#A78BFA', descricao: 'Borda roxa para o avatar.'
    },
    moldura_lendaria: {
        categoria: 'moldura', nome: 'Moldura Lendária', preco: 1800,
        valor: '#FBBF24', descricao: 'Borda dourada especial.'
    },
    cor_ciano: {
        categoria: 'corNome', nome: 'Nome Ciano', preco: 250,
        valor: '#22D3EE', descricao: 'Nome em ciano.'
    },
    cor_vermelha: {
        categoria: 'corNome', nome: 'Nome Rubi', preco: 350,
        valor: '#FB7185', descricao: 'Nome em vermelho-rosa.'
    },
    cor_verde: {
        categoria: 'corNome', nome: 'Nome Esmeralda', preco: 450,
        valor: '#4ADE80', descricao: 'Nome em verde.'
    },
    cor_dourada: {
        categoria: 'corNome', nome: 'Nome Dourado', preco: 900,
        valor: '#FACC15', descricao: 'Nome dourado.'
    },
    titulo_veterano: {
        categoria: 'titulo', nome: 'Veterano', preco: 500,
        valor: 'VETERANO', descricao: 'Título exibido no perfil.'
    },
    titulo_lendario: {
        categoria: 'titulo', nome: 'Lendário', preco: 1500,
        valor: 'LENDÁRIO', descricao: 'Título raro para seu perfil.'
    },
    titulo_magnata: {
        categoria: 'titulo', nome: 'Magnata', preco: 2500,
        valor: 'MAGNATA', descricao: 'Título de grande riqueza.'
    },
    fundo_oceano: {
        categoria: 'fundo', nome: 'Fundo Oceano', preco: 700,
        valor: 'oceano', descricao: 'Tema azul profundo.'
    },
    fundo_neon: {
        categoria: 'fundo', nome: 'Fundo Neon', preco: 1200,
        valor: 'neon', descricao: 'Tema roxo e ciano.'
    },
    fundo_fogo: {
        categoria: 'fundo', nome: 'Fundo Fogo', preco: 1600,
        valor: 'fogo', descricao: 'Tema vermelho e laranja.'
    },
    moldura_aurora: {
        categoria: 'moldura', nome: 'Moldura Aurora', preco: 1100,
        valor: '#5EEAD4', descricao: 'Borda verde-água com estilo aurora.'
    },
    moldura_rubi: {
        categoria: 'moldura', nome: 'Moldura Rubi', preco: 1350,
        valor: '#F43F5E', descricao: 'Borda vermelha intensa.'
    },
    moldura_prisma: {
        categoria: 'moldura', nome: 'Moldura Prisma', preco: 2200,
        valor: '#C084FC', descricao: 'Moldura especial em tom violeta.'
    },
    cor_rosa: {
        categoria: 'corNome', nome: 'Nome Rosa Neon', preco: 550,
        valor: '#F472B6', descricao: 'Nome em rosa neon.'
    },
    cor_gelo: {
        categoria: 'corNome', nome: 'Nome Gelo', preco: 650,
        valor: '#BAE6FD', descricao: 'Nome em azul-gelo.'
    },
    cor_laranja: {
        categoria: 'corNome', nome: 'Nome Âmbar', preco: 600,
        valor: '#FDBA74', descricao: 'Nome em laranja âmbar.'
    },
    titulo_explorador: {
        categoria: 'titulo', nome: 'Explorador', preco: 850,
        valor: 'EXPLORADOR', descricao: 'Para quem está sempre descobrindo algo.'
    },
    titulo_estrategista: {
        categoria: 'titulo', nome: 'Estrategista', preco: 1100,
        valor: 'ESTRATEGISTA', descricao: 'Título de jogador tático.'
    },
    titulo_colecionador: {
        categoria: 'titulo', nome: 'Colecionador', preco: 1300,
        valor: 'COLECIONADOR', descricao: 'Para quem gosta de completar coleções.'
    },
    fundo_floresta: {
        categoria: 'fundo', nome: 'Fundo Floresta', preco: 950,
        valor: 'floresta', descricao: 'Tema verde profundo.'
    },
    fundo_galaxia: {
        categoria: 'fundo', nome: 'Fundo Galáxia', preco: 1900,
        valor: 'galaxia', descricao: 'Tema espacial violeta.'
    },
    fundo_aurora: {
        categoria: 'fundo', nome: 'Fundo Aurora', preco: 2100,
        valor: 'aurora', descricao: 'Tema turquesa e azul.'
    }
};

const TEMAS_PERFIL = {
    padrao: ['#10132F', '#252B5A', '#12152F', '#FFE400'],
    oceano: ['#061D2B', '#075985', '#082F49', '#38BDF8'],
    neon: ['#170B2E', '#4C1D95', '#111827', '#22D3EE'],
    fogo: ['#2B0B0B', '#9A3412', '#431407', '#FB923C'],
    floresta: ['#052E22', '#166534', '#0F172A', '#4ADE80'],
    galaxia: ['#160B35', '#5B21B6', '#1E1B4B', '#C084FC'],
    aurora: ['#042F3A', '#0E7490', '#164E63', '#5EEAD4']
};

async function comprarItemPerfil(id, nome, itemId) {
    const item = ITENS_PERFIL[itemId];
    if (!item) {
        return '❌ Item não encontrado. Use !lojaperfil para ver a loja.';
    }

    const perfil = obterPersonalizacao(id);
    if (perfil.inventario.includes(itemId)) {
        return '⚠️ Você já possui esse item. Use !equiparperfil ' + itemId;
    }

    const carteira = obterCarteira(id, nome);
    if (carteira.saldo < item.preco) {
        return `❌ Saldo insuficiente. Você tem ${formatarWACoins(carteira.saldo)} e precisa de ${formatarWACoins(item.preco)}.`;
    }

    carteira.saldo = Math.round((carteira.saldo - item.preco) * 100) / 100;
    perfil.inventario.push(itemId);
    await Promise.all([salvarPersonalizacao(id), salvarWACoins()]);

    return `✅ *ITEM COMPRADO!*

${item.nome}
${item.descricao}
💸 Pago: ${formatarWACoins(item.preco)}
💰 Saldo restante: ${formatarWACoins(carteira.saldo)}

Para usar: !equiparperfil ${itemId}`;
}

async function equiparItemPerfil(id, itemId) {
    const perfil = obterPersonalizacao(id);
    if (!itemId) {
        return '❌ Informe o ID. Exemplo: !equiparperfil cor_ciano';
    }

    if (itemId === 'padrao') {
        perfil.equipado = {
            moldura: null,
            corNome: '#FFE400',
            titulo: null,
            fundo: 'padrao'
        };
        await salvarPersonalizacao(id);
        return '✅ Personalização padrão restaurada.';
    }

    const item = ITENS_PERFIL[itemId];
    if (!item) return '❌ Item não encontrado. Consulte !lojaperfil.';
    if (!perfil.inventario.includes(itemId)) {
        return '❌ Você ainda não possui esse item. Compre em !lojaperfil.';
    }

    await equiparPersonalizacao(id, item.categoria, item.valor);
    return `✅ *${item.nome} equipado!*\n\nUse !perfil para visualizar.`;
}

function montarLojaPerfil(id, nome) {
    const carteira = obterCarteira(id, nome);
    const perfil = obterPersonalizacao(id);
    const grupos = [
        ['🖼️ MOLDURAS', 'moldura'],
        ['🎨 CORES DO NOME', 'corNome'],
        ['🏷️ TÍTULOS', 'titulo'],
        ['🌌 FUNDOS', 'fundo']
    ];

    const linhas = [
        '🛍️ *LOJA DE PERSONALIZAÇÃO*',
        `💰 Saldo: *${formatarWACoins(carteira.saldo)}*`,
        '',
        'Personalize seu cartão de !perfil.',
        '━━━━━━━━━━━━━━━━━━'
    ];

    for (const [titulo, categoria] of grupos) {
        linhas.push('', `*${titulo}*`);
        for (const [itemId, item] of Object.entries(ITENS_PERFIL)) {
            if (item.categoria !== categoria) continue;
            const possui = perfil.inventario.includes(itemId);
            linhas.push(
                `${possui ? '✅' : '▫️'} *${item.nome}* — ${formatarWACoins(item.preco)}`,
                `   ${item.descricao}`,
                `   ID: \`${itemId}\``
            );
        }
    }

    linhas.push(
        '',
        '━━━━━━━━━━━━━━━━━━',
        '🛒 Comprar: !comprarperfil ID',
        '✨ Equipar: !equiparperfil ID',
        '🎒 Inventário: !inventarioperfil',
        '♻️ Restaurar padrão: !equiparperfil padrao'
    );

    return linhas.join('\n');
}

function montarInventarioPerfil(id) {
    const perfil = obterPersonalizacao(id);
    if (!perfil.inventario.length) {
        return '🎒 Seu inventário está vazio. Use !lojaperfil para comprar personalizações.';
    }

    const equipado = perfil.equipado || {};
    const linhas = ['🎒 *SEU INVENTÁRIO DE PERFIL*', ''];
    for (const itemId of perfil.inventario) {
        const item = ITENS_PERFIL[itemId];
        if (!item) continue;
        const ativo = equipado[item.categoria] === item.valor;
        linhas.push(`${ativo ? '🟢' : '▫️'} ${item.nome} — ${itemId}${ativo ? ' (equipado)' : ''}`);
    }
    linhas.push('', 'Para equipar: !equiparperfil ID');
    return linhas.join('\n');
}

// ==================================================
// ENVIO DE MENSAGENS
// ==================================================

async function enviar(sock, jid, conteudo, registrar = true) {
    const enviada = await sock.sendMessage(jid, conteudo);

    if (registrar && enviada?.key?.id) {
        if (!mensagensComando[jid]) {
            mensagensComando[jid] = [];
        }

        mensagensComando[jid].push(enviada.key);
        mensagensComando[jid] = mensagensComando[jid].slice(-500);

        await salvarJSON(ARQUIVO_MENSAGENS, mensagensComando);
    }

    return enviada;
}

async function texto(sock, jid, conteudo, registrar = true) {
    return enviar(sock, jid, { text: conteudo }, registrar);
}

// ==================================================
// ADMINISTRAÇÃO
// ==================================================

async function usuarioEhAdmin(sock, jid, msg) {
    if (msg.key.fromMe) return true;
    if (!jid.endsWith('@g.us')) return false;

    try {
        const grupo = await sock.groupMetadata(jid);
        const id = obterParticipante(msg);

        const membro = grupo.participants.find(p =>
            mesmoUsuario(p.id, id) ||
            mesmoUsuario(p.jid, id) ||
            mesmoUsuario(p.phoneNumber, id)
        );

        return membro?.admin === 'admin' ||
            membro?.admin === 'superadmin';
    } catch (erro) {
        console.error('Erro ao verificar administrador:', erro);
        return false;
    }
}

async function limparMensagens(sock, jid, quantidade) {
    const lista = mensagensComando[jid] || [];

    const selecionadas = quantidade === Infinity
        ? [...lista]
        : lista.slice(-quantidade);

    const restantes = quantidade === Infinity
        ? []
        : lista.slice(0, -quantidade);

    let apagadas = 0;
    const falhas = [];

    for (const chave of selecionadas) {
        try {
            await sock.sendMessage(jid, { delete: chave });
            apagadas++;
        } catch (erro) {
            falhas.push(chave);
            console.log('Falha ao apagar mensagem:', erro.message);
        }
    }

    mensagensComando[jid] = [...restantes, ...falhas];

    await salvarJSON(ARQUIVO_MENSAGENS, mensagensComando);

    return {
        apagadas,
        falhas: falhas.length
    };
}

// ==================================================
// QUIZ
// ==================================================

function iniciarQuiz(jid, dificuldade = 'NORMAL') {
    const hard = dificuldade === 'HARD';
    const pergunta = aleatorio(hard ? perguntasHard : perguntas);

    quizzesAtivos.set(jid, {
        pergunta,
        participantes: new Set(),
        tentativas: 0,
        pontos: hard ? 25 : 10,
        recompensaWACoins: hard ? 25 : 10,
        dificuldade
    });

    return pergunta;
}

function montarRanking() {
    return Object.entries(carteirasWACoins)
        .filter(([id, carteira]) => !id.startsWith('__') && carteira && typeof carteira === 'object')
        .sort((a, b) => Number(b[1].saldo || 0) - Number(a[1].saldo || 0))
        .slice(0, 10)
        .map(([id, carteira], index) => `${index + 1}º ${carteira.nome || nomeExibicao(id)} — ${formatarWACoins(carteira.saldo)}`)
        .join('\n');
}

// ==================================================
// RANKING VISUAL
// ==================================================

async function gerarImagemRanking() {
    const ranking = Object.entries(carteirasWACoins)
        .filter(([id, carteira]) => !id.startsWith('__') && carteira && typeof carteira === 'object' && Number.isFinite(Number(carteira.saldo)))
        .sort((a, b) => Number(b[1].saldo || 0) - Number(a[1].saldo || 0))
        .slice(0, 10);

    const largura = 1024;
    const altura = 1024;

    const linhas = ranking.map(([id, dados], index) => {
        const posicao = index + 1;
        const y = 260 + index * 69;

        const nome = escaparSVG(
            String(dados.nome || nomeExibicao(id)).slice(0, 22)
        );

        const saldo = formatarWACoins(dados.saldo);

        const medalhas = [
            { fundo: '#FFF0B3', medalha: '#E7A900', texto: '#8A5A00' },
            { fundo: '#E8ECF5', medalha: '#9AA7BD', texto: '#46536B' },
            { fundo: '#F5DDCB', medalha: '#C47B49', texto: '#804321' }
        ];

        const estilo = medalhas[index] || {
            fundo: '#25294B',
            medalha: '#444A70',
            texto: '#FFFFFF'
        };

        return `
            <rect x="65" y="${y}" width="894" height="58"
                rx="15" fill="${estilo.fundo}"/>

            <circle cx="105" cy="${y + 29}" r="20"
                fill="${estilo.medalha}"/>

            <text x="105" y="${y + 37}"
                text-anchor="middle"
                font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif"
                font-size="23"
                font-weight="bold"
                fill="#FFFFFF">
                ${posicao}
            </text>

            <text x="150" y="${y + 37}"
                font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif"
                font-size="25"
                font-weight="bold"
                fill="${estilo.texto}">
                ${nome}
            </text>

            <rect x="795" y="${y + 9}" width="145" height="40"
                rx="12" fill="#171A3B"/>

            <text x="867" y="${y + 36}"
                text-anchor="middle"
                font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif"
                font-size="16"
                font-weight="bold"
                fill="#FFE400">
                ${saldo}
            </text>
        `;
    }).join('');

    const svg = `
    <svg width="${largura}" height="${altura}"
        xmlns="http://www.w3.org/2000/svg">

        <defs>
            <linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#10132F"/>
                <stop offset="100%" stop-color="#292E63"/>
            </linearGradient>

            <linearGradient id="ouro" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#FFE400"/>
                <stop offset="100%" stop-color="#FFB800"/>
            </linearGradient>
        </defs>

        <rect width="1024" height="1024" fill="#F0F1F8"/>
        <rect width="1024" height="205" fill="url(#fundo)"/>

        <circle cx="900" cy="35" r="150"
            fill="#FFFFFF" opacity="0.035"/>

        <circle cx="980" cy="180" r="100"
            fill="#FFE400" opacity="0.06"/>

        <rect x="65" y="48" width="8" height="105"
            rx="4" fill="url(#ouro)"/>

        <text x="95" y="91"
            font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif"
            font-size="23"
            font-weight="bold"
            letter-spacing="5"
            fill="#FFE400">
            WABOT • QUIZ
        </text>

        <text x="95" y="145"
            font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif"
            font-size="49"
            font-weight="bold"
            fill="#FFFFFF">
            RANKING
        </text>

        <text x="900" y="112"
            text-anchor="middle"
            font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif"
            font-size="57"
            font-weight="bold"
            fill="#FFE400">
            ★
        </text>

        <rect x="45" y="225" width="934" height="755"
            rx="25" fill="#FFFFFF"/>

        <text x="75" y="252"
            font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif"
            font-size="17"
            font-weight="bold"
            letter-spacing="2"
            fill="#777D99">
            TOP 10 JOGADORES
        </text>

        <text x="935" y="252"
            text-anchor="end"
            font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif"
            font-size="16"
            font-weight="bold"
            fill="#777D99">
            PONTOS
        </text>

        ${linhas}

        ${ranking.length === 0 ? `
            <text x="512" y="560"
                text-anchor="middle"
                font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif"
                font-size="28"
                font-weight="bold"
                fill="#292E63">
                NENHUM JOGADOR AINDA
            </text>

            <text x="512" y="605"
                text-anchor="middle"
                font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif"
                font-size="19"
                fill="#777D99">
                Participe dos quizzes para aparecer aqui!
            </text>
        ` : ''}

        <text x="512" y="1008"
            text-anchor="middle"
            font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif"
            font-size="13"
            letter-spacing="2"
            fill="#777D99">
            WABOT • RANKING ATUALIZADO AUTOMATICAMENTE
        </text>

    </svg>`;

    return sharp(IMAGEM_RANKING)
        .resize(largura, altura)
        .composite([{
            input: Buffer.from(svg),
            top: 0,
            left: 0
        }])
        .png()
        .toBuffer();
}

// ==================================================
// PERFIL VISUAL
// ==================================================

function obterPontosQuiz(id) {
    if (pontuacaoQuiz[id]) {
        return Number(pontuacaoQuiz[id].pontos || 0);
    }

    const encontrado = Object.entries(pontuacaoQuiz).find(
        ([usuarioId]) => mesmoUsuario(usuarioId, id)
    );

    return encontrado
        ? Number(encontrado[1].pontos || 0)
        : 0;
}
async function obterFotoPerfil(sock, id, nome) {
    try {
        const url = await sock.profilePictureUrl(id, 'image');

        if (url) {
            const resposta = await fetch(url);

            if (resposta.ok) {
                const buffer = Buffer.from(
                    await resposta.arrayBuffer()
                );

                return await sharp(buffer)
                    .resize(174, 174, {
                        fit: 'cover',
                        position: 'centre'
                    })
                    .composite([{
                        input: Buffer.from(`
                            <svg width="174" height="174"
                                xmlns="http://www.w3.org/2000/svg">
                                <circle cx="87" cy="87" r="87" fill="#FFFFFF"/>
                            </svg>
                        `),
                        blend: 'dest-in'
                    }])
                    .png()
                    .toBuffer();
            }
        }
    } catch (erro) {
        console.log(
            '[WABOT] Não foi possível obter a foto do perfil:',
            erro.message
        );
    }

    const inicial = escaparSVG(
        String(nome || '?').trim().charAt(0).toUpperCase()
    );

    const avatar = `
    <svg width="174" height="174"
        xmlns="http://www.w3.org/2000/svg">

        <defs>
            <linearGradient id="avatar" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#665CFF"/>
                <stop offset="100%" stop-color="#151A42"/>
            </linearGradient>
        </defs>

        <circle cx="87" cy="87" r="87"
            fill="url(#avatar)"/>

        <text x="87" y="119"
            text-anchor="middle"
            font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif"
            font-size="84"
            font-weight="bold"
            fill="#FFFFFF">
            ${inicial}
        </text>
    </svg>`;

    return sharp(Buffer.from(avatar))
        .png()
        .toBuffer();
}

function calcularNivelPerfil(pontos) {
    const total = Math.max(0, Number(pontos) || 0);
    const XP_POR_NIVEL = 80;
    const nivel = Math.floor(total / XP_POR_NIVEL) + 1;
    const progresso = total % XP_POR_NIVEL;
    return { nivel, progresso, faltam: XP_POR_NIVEL - progresso, xpPorNivel: XP_POR_NIVEL };
}

function obterConquistasDetalhadas(id) {
    const pontos = Math.max(0, Number(obterPontosQuiz(id)) || 0);
    const pescador = dadosPesca[id] || Object.entries(dadosPesca).find(
        ([usuarioId]) => mesmoUsuario(usuarioId, id)
    )?.[1] || {};
    const peixes = Array.isArray(pescador.peixes) ? pescador.peixes : [];
    const capturas = Math.max(Number(pescador.capturas || 0), peixes.length);
    const raridades = {
        comum: peixes.filter(p => p.raridade === 'comum').length,
        incomum: peixes.filter(p => p.raridade === 'incomum').length,
        raro: peixes.filter(p => p.raridade === 'raro').length,
        epico: peixes.filter(p => p.raridade === 'epico').length,
        lendario: peixes.filter(p => p.raridade === 'lendario').length,
        divina: peixes.filter(p => p.raridade === 'divina').length
    };
    const maiorPeixe = Math.max(
        Number(pescador.maiorPeixe || 0),
        ...peixes.map(p => Number(p.peso || 0))
    );
    const especies = new Set(peixes.map(p => String(p.nome || '').toLowerCase())).size;
    const saldo = Math.max(0, Number(obterCarteira(id, pescador.nome || '').saldo) || 0);
    const nivel = calcularNivelPerfil(pontos).nivel;

    const lista = [
        { nome: 'Primeiros passos', icone: '🌱', descricao: 'Alcance 10 pontos de quiz', atual: pontos, meta: 10 },
        { nome: 'Mente afiada', icone: '🧠', descricao: 'Alcance 100 pontos de quiz', atual: pontos, meta: 100 },
        { nome: 'Quiz master', icone: '🏅', descricao: 'Alcance 500 pontos de quiz', atual: pontos, meta: 500 },
        { nome: 'Gênio', icone: '👑', descricao: 'Alcance 1.500 pontos de quiz', atual: pontos, meta: 1500 },
        { nome: 'Enciclopédia', icone: '📚', descricao: 'Alcance 5.000 pontos de quiz', atual: pontos, meta: 5000 },
        { nome: 'Lenda do conhecimento', icone: '🎓', descricao: 'Alcance 10.000 pontos de quiz', atual: pontos, meta: 10000 },
        { nome: 'Nível 5', icone: '⭐', descricao: 'Chegue ao nível 5', atual: nivel, meta: 5 },
        { nome: 'Nível 10', icone: '🌟', descricao: 'Chegue ao nível 10', atual: nivel, meta: 10 },
        { nome: 'Nível 25', icone: '💫', descricao: 'Chegue ao nível 25', atual: nivel, meta: 25 },
        { nome: 'Pescador', icone: '🎣', descricao: 'Capture 10 peixes', atual: capturas, meta: 10 },
        { nome: 'Mestre da pesca', icone: '🐟', descricao: 'Capture 50 peixes', atual: capturas, meta: 50 },
        { nome: 'Lenda dos mares', icone: '🌊', descricao: 'Capture 150 peixes', atual: capturas, meta: 150 },
        { nome: 'Frota pesqueira', icone: '🚤', descricao: 'Capture 500 peixes', atual: capturas, meta: 500 },
        { nome: 'Colecionador', icone: '🗃️', descricao: 'Capture 10 espécies diferentes', atual: especies, meta: 10 },
        { nome: 'Coleção completa', icone: '🏆', descricao: 'Capture 25 espécies diferentes', atual: especies, meta: 25 },
        { nome: 'Olho raro', icone: '💎', descricao: 'Capture 10 peixes raros', atual: raridades.raro, meta: 10 },
        { nome: 'Pesca épica', icone: '🔮', descricao: 'Capture 5 peixes épicos', atual: raridades.epico, meta: 5 },
        { nome: 'Caçador lendário', icone: '🐉', descricao: 'Capture 3 peixes lendários', atual: raridades.lendario, meta: 3 },
        { nome: 'Toque divino', icone: '✨', descricao: 'Capture 1 peixe divino', atual: raridades.divina, meta: 1 },
        { nome: 'Abençoado pelos mares', icone: '🌌', descricao: 'Capture 5 peixes divinos', atual: raridades.divina, meta: 5 },
        { nome: 'Peixe parrudo', icone: '⚖️', descricao: 'Capture um peixe de 1 kg', atual: maiorPeixe, meta: 1000 },
        { nome: 'Gigante abissal', icone: '🦈', descricao: 'Capture um peixe de 5 kg', atual: maiorPeixe, meta: 5000 },
        { nome: 'Primeira fortuna', icone: '🪙', descricao: 'Tenha 1.000 WACoins', atual: saldo, meta: 1000 },
        { nome: 'Magnata', icone: '💰', descricao: 'Tenha 10.000 WACoins', atual: saldo, meta: 10000 }
    ];

    return lista.map(item => ({
        ...item,
        atual: Math.max(0, Number(item.atual) || 0),
        desbloqueada: Number(item.atual) >= Number(item.meta)
    }));
}

function obterConquistasPerfil(id) {
    return obterConquistasDetalhadas(id)
        .filter(item => item.desbloqueada)
        .map(item => `${item.icone} ${item.nome}`);
}

async function gerarImagemPerfil(sock, id, nome) {
    const pontos = obterPontosQuiz(id);
    const carteira = obterCarteira(id, nome);
    const personalizacao = obterPersonalizacao(id);
    const equipado = personalizacao.equipado || {};
    const pescador = dadosPesca[id] || Object.entries(dadosPesca).find(
        ([usuarioId]) => mesmoUsuario(usuarioId, id)
    )?.[1] || {};
    const capturas = Number(pescador.capturas || 0);
    const nivelInfo = calcularNivelPerfil(pontos);
    const conquistas = obterConquistasPerfil(id);
    const statusOriginal = String(personalizacao.status || 'Disponível para jogar').slice(0, 30);
    const status = escaparSVG(statusOriginal);
    const statusFonte = Math.max(12, Math.min(19, 280 / Math.max(1, statusOriginal.length * 0.58)));
    const corNome = /^#[0-9A-Fa-f]{6}$/.test(equipado.corNome || '')
        ? equipado.corNome : '#FFE400';
    const tema = TEMAS_PERFIL[equipado.fundo] || TEMAS_PERFIL.padrao;
    const moldura = /^#[0-9A-Fa-f]{6}$/.test(equipado.moldura || '')
        ? equipado.moldura : tema[3];
    const titulo = escaparSVG(String(equipado.titulo || 'JOGADOR').slice(0, 24));
    const nomeOriginal = String(nome || 'Jogador').trim() || 'Jogador';
    const nomeSeguro = escaparSVG(nomeOriginal.slice(0, 25));
    // Ajusta o tamanho do nome para evitar que invada o painel de nível.
    const nomeFonte = Math.max(18, Math.min(47, 290 / Math.max(1, nomeOriginal.length * 0.58)));
    const tituloFonte = Math.max(12, Math.min(19, 260 / Math.max(1, String(equipado.titulo || 'JOGADOR').length * 0.66)));
    const bioOriginal = String(personalizacao.bio || 'Este jogador ainda não escreveu uma bio.').trim();
    const bioPalavras = bioOriginal.slice(0, 92).split(/\s+/);
    const bioLinhas = [''];
    for (const palavra of bioPalavras) {
        const atual = bioLinhas[bioLinhas.length - 1];
        if ((atual + ' ' + palavra).trim().length > 58 && bioLinhas.length < 2) bioLinhas.push(palavra);
        else bioLinhas[bioLinhas.length - 1] = (atual + ' ' + palavra).trim();
    }
    const bioLinha1 = escaparSVG(bioLinhas[0] || '');
    const bioLinha2 = escaparSVG(bioLinhas[1] || '');
    const conquistasTexto = conquistas.length
        ? escaparSVG(conquistas.slice(0, 3).join('  •  '))
        : 'Nenhuma conquista desbloqueada ainda';
    const avatar = await obterFotoPerfil(sock, id, nome);
    const progresso = nivelInfo.progresso;

    const svg = `
    <svg width="1100" height="790" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${tema[0]}"/>
          <stop offset="55%" stop-color="${tema[1]}"/>
          <stop offset="100%" stop-color="${tema[2]}"/>
        </linearGradient>
        <linearGradient id="brilho" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${moldura}"/>
          <stop offset="100%" stop-color="${corNome}"/>
        </linearGradient>
        <linearGradient id="barra" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${moldura}"/>
          <stop offset="100%" stop-color="${corNome}"/>
        </linearGradient>
      </defs>

      <rect width="1100" height="760" rx="38" fill="url(#fundo)"/>
      <circle cx="1010" cy="80" r="210" fill="#FFFFFF" opacity=".035"/>
      <circle cx="70" cy="720" r="230" fill="${moldura}" opacity=".08"/>
      <path d="M0 210 Q280 90 550 190 T1100 130 L1100 0 L0 0Z" fill="#FFFFFF" opacity=".035"/>
      <rect x="42" y="38" width="1016" height="684" rx="30" fill="none" stroke="${moldura}" stroke-opacity=".55" stroke-width="3"/>

      <text x="76" y="92" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="25" font-weight="bold" letter-spacing="7" fill="${corNome}">WABOT / PLAYER CARD</text>
      <text x="76" y="137" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="17" letter-spacing="3" fill="#C5CAE8">IDENTIDADE • CONQUISTAS • ESTATÍSTICAS</text>

      <rect x="62" y="174" width="976" height="270" rx="28" fill="#080B20" opacity=".52"/>
      <circle cx="218" cy="306" r="116" fill="${moldura}" opacity=".22"/>
      <circle cx="218" cy="306" r="105" fill="none" stroke="url(#brilho)" stroke-width="13"/>
      <circle cx="218" cy="306" r="94" fill="#10152F" stroke="#FFFFFF" stroke-opacity=".2" stroke-width="3"/>

      <text x="385" y="245" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="18" font-weight="bold" letter-spacing="4" fill="#AEB8DE">JOGADOR</text>
      <text x="385" y="302" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="${nomeFonte}" font-weight="bold" fill="${corNome}">${nomeSeguro}</text>
      <rect x="385" y="326" width="260" height="45" rx="14" fill="${moldura}" opacity=".2"/>
      <text x="515" y="356" text-anchor="middle" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="${tituloFonte}" font-weight="bold" letter-spacing="1.4" fill="${moldura}">${titulo}</text>
      <circle cx="397" cy="405" r="7" fill="#4ADE80"/>
      <text x="417" y="412" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="${statusFonte}" fill="#D9E1FF">${status}</text>

      <rect x="700" y="218" width="290" height="170" rx="22" fill="#FFFFFF" opacity=".07"/>
      <text x="730" y="260" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="17" font-weight="bold" letter-spacing="3" fill="#AEB8DE">NÍVEL</text>
      <text x="730" y="330" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="64" font-weight="bold" fill="${moldura}">${nivelInfo.nivel}</text>
      <text x="835" y="328" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="17" fill="#D9E1FF">PLAYER LEVEL</text>
      <rect x="730" y="350" width="225" height="12" rx="6" fill="#FFFFFF" opacity=".16"/>
      <rect x="730" y="350" width="${Math.max(4, 225 * progresso / 100)}" height="12" rx="6" fill="url(#barra)"/>
      <text x="730" y="382" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="14" fill="#AEB8DE">${progresso}/${nivelInfo.xpPorNivel} XP • faltam ${nivelInfo.faltam}</text>

      <text x="78" y="492" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="18" font-weight="bold" letter-spacing="3" fill="#AEB8DE">SOBRE MIM</text>
      <rect x="62" y="510" width="976" height="64" rx="17" fill="#080B20" opacity=".48"/>
      <text x="88" y="539" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="19" fill="#FFFFFF">${bioLinha1}</text>
      <text x="88" y="562" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="19" fill="#FFFFFF">${bioLinha2}</text>

      <text x="78" y="596" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="14" font-weight="bold" letter-spacing="2" fill="#AEB8DE">CONQUISTAS</text>
      <text x="225" y="596" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="15" fill="${moldura}">${conquistasTexto}</text>

      <rect x="62" y="616" width="300" height="88" rx="18" fill="#FFFFFF" opacity=".08"/>
      <text x="88" y="650" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="15" letter-spacing="2" fill="#AEB8DE">PONTOS DE QUIZ</text>
      <text x="88" y="686" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="29" font-weight="bold" fill="${corNome}">${pontos.toLocaleString('pt-BR')}</text>

      <rect x="400" y="616" width="300" height="88" rx="18" fill="#FFFFFF" opacity=".08"/>
      <text x="426" y="650" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="15" letter-spacing="2" fill="#AEB8DE">PEIXES CAPTURADOS</text>
      <text x="426" y="686" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="29" font-weight="bold" fill="${moldura}">${capturas.toLocaleString('pt-BR')}</text>

      <rect x="738" y="616" width="300" height="88" rx="18" fill="#FFFFFF" opacity=".08"/>
      <text x="764" y="650" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="15" letter-spacing="2" fill="#AEB8DE">WACOINS</text>
      <text x="764" y="686" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="29" font-weight="bold" fill="#FACC15">${escaparSVG(formatarWACoins(carteira.saldo))}</text>

      <text x="550" y="754" text-anchor="middle" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="13" letter-spacing="2" fill="#AEB8DE">WABOT • CARTÃO DE JOGADOR</text>
    </svg>`;

    const base = await sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    return sharp(base).composite([{ input: avatar, left: 131, top: 219 }]).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

async function gerarImagemConquistas(id, nome) {
    const conquistas = obterConquistasDetalhadas(id);
    const desbloqueadas = conquistas.filter(item => item.desbloqueada).length;
    const largura = 1200;
    const cardW = 520;
    const cardH = 148;
    const gapX = 36;
    const gapY = 18;
    const linhas = Math.ceil(conquistas.length / 2);
    const inicioY = 300;
    const altura = inicioY + linhas * (cardH + gapY) + 100;

    const cards = conquistas.map((item, index) => {
        const coluna = index % 2;
        const linha = Math.floor(index / 2);
        const x = 62 + coluna * (cardW + gapX);
        const y = inicioY + linha * (cardH + gapY);
        const cor = item.desbloqueada ? '#F6C85F' : '#667085';
        const fundo = item.desbloqueada ? '#1D3552' : '#182337';
        const progresso = Math.min(100, Math.floor((item.atual / item.meta) * 100));
        const barra = item.desbloqueada ? 100 : progresso;
        const nomeSeguro = escaparSVG(item.nome);
        const descricao = escaparSVG(item.descricao);
        return `
          <rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="20" fill="${fundo}" stroke="${cor}" stroke-opacity=".55" stroke-width="2"/>
          <circle cx="${x+48}" cy="${y+48}" r="29" fill="${cor}" opacity=".16"/>
          <text x="${x+48}" y="${y+59}" text-anchor="middle" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="29" fill="${cor}">${item.desbloqueada ? '★' : '◇'}</text>
          <text x="${x+92}" y="${y+43}" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="21" font-weight="bold" fill="${item.desbloqueada ? '#FFFFFF' : '#AAB4C5'}">${nomeSeguro}</text>
          <text x="${x+92}" y="${y+72}" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="14" fill="#B7C5D8">${descricao}</text>
          <rect x="${x+26}" y="${y+96}" width="${cardW-52}" height="10" rx="5" fill="#FFFFFF" opacity=".12"/>
          <rect x="${x+26}" y="${y+96}" width="${(cardW-52)*barra/100}" height="10" rx="5" fill="${cor}"/>
          <text x="${x+26}" y="${y+129}" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="13" fill="#C6D2E1">${Math.min(item.atual,item.meta).toLocaleString('pt-BR')} / ${item.meta.toLocaleString('pt-BR')}</text>
          <text x="${x+cardW-26}" y="${y+129}" text-anchor="end" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="12" font-weight="bold" fill="${cor}">${item.desbloqueada ? 'DESBLOQUEADA' : 'BLOQUEADA'}</text>`;
    }).join('');

    const nomeSeguro = escaparSVG(String(nome || 'Jogador').slice(0, 28));
    const svg = `<svg width="${largura}" height="${altura}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#071426"/><stop offset="55%" stop-color="#15365A"/><stop offset="100%" stop-color="#10152D"/>
        </linearGradient>
        <linearGradient id="acc"><stop offset="0%" stop-color="#F6C85F"/><stop offset="100%" stop-color="#54D6C8"/></linearGradient>
      </defs>
      <rect width="${largura}" height="${altura}" fill="url(#bgc)"/>
      <circle cx="1120" cy="90" r="210" fill="#57D9CF" opacity=".06"/>
      <circle cx="40" cy="${altura-40}" r="250" fill="#A78BFA" opacity=".07"/>
      <rect x="34" y="34" width="${largura-68}" height="${altura-68}" rx="34" fill="#091B30" stroke="#2B5675" stroke-width="2"/>
      <rect x="68" y="74" width="8" height="100" rx="4" fill="url(#acc)"/>
      <text x="102" y="111" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="20" font-weight="bold" letter-spacing="5" fill="#67DED2">WABOT • PLAYER ACHIEVEMENTS</text>
      <text x="102" y="174" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="43" font-weight="bold" fill="#FFFFFF">CONQUISTAS</text>
      <text x="102" y="218" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="20" fill="#B6C8DA">${nomeSeguro}</text>
      <rect x="900" y="90" width="220" height="104" rx="20" fill="#FFFFFF" opacity=".07"/>
      <text x="930" y="130" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="15" letter-spacing="2" fill="#B6C8DA">PROGRESSO</text>
      <text x="930" y="174" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="34" font-weight="bold" fill="#F6C85F">${desbloqueadas}/${conquistas.length}</text>
      ${cards}
      <text x="${largura/2}" y="${altura-48}" text-anchor="middle" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="14" letter-spacing="3" fill="#8CA9C2">JOGUE • EVOLUA • DESBLOQUEIE</text>
    </svg>`;
    return sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

function quebrarTextoSVG(texto, limite = 48, maxLinhas = 4) {
    const palavras = String(texto || '').split(/\s+/).filter(Boolean);
    const linhas = [];
    let linha = '';
    for (const palavra of palavras) {
        const tentativa = linha ? `${linha} ${palavra}` : palavra;
        if (tentativa.length > limite && linha) {
            linhas.push(linha);
            linha = palavra;
        } else {
            linha = tentativa;
        }
    }
    if (linha) linhas.push(linha);
    if (linhas.length > maxLinhas) {
        linhas.length = maxLinhas;
        linhas[maxLinhas - 1] = linhas[maxLinhas - 1].slice(0, limite - 3) + '...';
    }
    return linhas.map(escaparSVG);
}

async function gerarImagemDivulgacao(tipo, titulo, descricao, chamada) {
    const tipos = {
        grupo: 'GRUPO DO WHATSAPP',
        canal: 'CANAL DO WHATSAPP',
        projeto: 'PROJETO',
        loja: 'LOJA / SERVIÇO',
        evento: 'EVENTO',
        comunidade: 'COMUNIDADE',
        outro: 'DIVULGAÇÃO'
    };
    const rotulo = tipos[tipo] || tipos.outro;
    const tituloLinhas = quebrarTextoSVG(titulo, 30, 2);
    const descricaoLinhas = quebrarTextoSVG(descricao, 48, 4);
    const chamadaSegura = escaparSVG(chamada || 'ACESSE E PARTICIPE');
    const tituloSVG = tituloLinhas.map((linha, i) =>
        `<text x="90" y="${300 + i*58}" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="43" font-weight="bold" fill="#FFFFFF">${linha}</text>`
    ).join('');
    const descricaoSVG = descricaoLinhas.map((linha, i) =>
        `<text x="94" y="${450 + i*39}" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="24" fill="#D4E4F3">${linha}</text>`
    ).join('');
    const svg = `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="divbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#10133A"/><stop offset="55%" stop-color="#164E63"/><stop offset="100%" stop-color="#0B172B"/>
        </linearGradient>
        <linearGradient id="divacc"><stop offset="0%" stop-color="#67E8F9"/><stop offset="100%" stop-color="#A78BFA"/></linearGradient>
      </defs>
      <rect width="1080" height="1080" fill="url(#divbg)"/>
      <circle cx="950" cy="120" r="270" fill="#67E8F9" opacity=".08"/>
      <circle cx="80" cy="1000" r="300" fill="#A78BFA" opacity=".08"/>
      <rect x="48" y="48" width="984" height="984" rx="42" fill="#07182B" fill-opacity=".72" stroke="#4C8299" stroke-width="2"/>
      <rect x="90" y="105" width="12" height="116" rx="6" fill="url(#divacc)"/>
      <text x="132" y="145" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="25" font-weight="bold" letter-spacing="6" fill="#7DE5E5">WABOT • DIVULGAÇÃO</text>
      <rect x="90" y="190" width="420" height="48" rx="16" fill="#FFFFFF" opacity=".09"/>
      <text x="300" y="222" text-anchor="middle" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="18" font-weight="bold" letter-spacing="2" fill="#C8E7F4">${escaparSVG(rotulo)}</text>
      ${tituloSVG}
      <rect x="90" y="405" width="900" height="260" rx="26" fill="#FFFFFF" opacity=".055"/>
      ${descricaoSVG}
      <rect x="90" y="760" width="900" height="112" rx="24" fill="url(#divacc)" opacity=".18"/>
      <text x="540" y="827" text-anchor="middle" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="30" font-weight="bold" letter-spacing="2" fill="#FFFFFF">${chamadaSegura}</text>
      <text x="540" y="956" text-anchor="middle" font-family="DejaVu Sans, Noto Sans, Noto Color Emoji, sans-serif" font-size="17" letter-spacing="5" fill="#8FB4C9">COMPARTILHE • CONECTE • PARTICIPE</text>
    </svg>`;
    return sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

// ==================================================
// ANAGRAMA
// ==================================================

function embaralharPalavra(palavra) {
    const letras = [...palavra];

    for (let i = letras.length - 1; i > 0; i--) {
        const j = randomInt(0, i + 1);
        [letras[i], letras[j]] = [letras[j], letras[i]];
    }

    let resultado = letras.join('');

    if (resultado === palavra && letras.length > 1) {
        resultado = letras.slice(1).join('') + letras[0];
    }

    return resultado;
}

// ==================================================
// FORCA
// ==================================================

function mostrarForca(jogo) {
    const desenhos = [
        '  +---+\n  |   |\n      |\n      |\n      |\n=========',
        '  +---+\n  |   |\n  O   |\n      |\n      |\n=========',
        '  +---+\n  |   |\n  O   |\n  |   |\n      |\n=========',
        '  +---+\n  |   |\n  O   |\n /|   |\n      |\n=========',
        '  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n=========',
        '  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n=========',
        '  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n========='
    ];

    const ocultada = [...jogo.palavra]
        .map(letra =>
            jogo.letras.includes(letra)
                ? letra.toUpperCase()
                : '＿'
        )
        .join(' ');

    return `${desenhos[Math.min(jogo.erros, 6)]}\n\n${ocultada}`;
}

// ==================================================
// REAÇÕES
// ==================================================

function obterContextoCitado(msg) {
    return (
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo ||
        msg.message?.documentMessage?.contextInfo ||
        null
    );
}

function obterChaveCitada(msg, sock) {
    const contexto = obterContextoCitado(msg);

    if (!contexto?.stanzaId) return null;

    const autor = contexto.participant || contexto.participantAlt;

    const chave = {
        remoteJid: msg.key.remoteJid,
        id: contexto.stanzaId,
        fromMe:
            mesmoUsuario(autor, sock.user?.id) ||
            mesmoUsuario(autor, sock.user?.lid)
    };

    if (autor) chave.participant = autor;

    return chave;
}

// ==================================================
// ENQUETES
// ==================================================

function montarResultadoEnquete(sock, enquete) {
    try {
        const resultado = getAggregateVotesInPollMessage(
            {
                message: enquete.message,
                pollUpdates: enquete.pollUpdates || []
            },
            sock.user?.id
        );

        if (!resultado?.length) {
            return 'Ainda não há votos disponíveis.';
        }

        return resultado.map(opcao =>
            `${opcao.name}: ${opcao.voters?.length || 0} voto(s)`
        ).join('\n');
    } catch (erro) {
        console.error('Erro ao calcular enquete:', erro);
        return 'Não foi possível calcular os votos.';
    }
}


// ==================================================
// RPG INDEPENDENTE (economia e progresso separados)
// ==================================================

const RPG_INIMIGOS = [
    { nome: 'Slime da Floresta', hp: 32, ataque: 7, defesa: 1, xp: 22, moedas: 14, habilidade: 'Ácido viscoso' },
    { nome: 'Lobo Cinzento', hp: 46, ataque: 10, defesa: 2, xp: 32, moedas: 22, habilidade: 'Investida feroz' },
    { nome: 'Goblin Saqueador', hp: 58, ataque: 12, defesa: 3, xp: 42, moedas: 30, habilidade: 'Golpe oportunista' },
    { nome: 'Golem de Pedra', hp: 85, ataque: 15, defesa: 6, xp: 65, moedas: 48, habilidade: 'Pele de pedra' },
    { nome: 'Cavaleiro Esquecido', hp: 110, ataque: 19, defesa: 7, xp: 90, moedas: 70, habilidade: 'Corte espectral' }
];

const RPG_ITENS = {
    pocao: { nome: 'Poção de vida', preco: 25, tipo: 'consumivel', cura: 45 },
    pocao_grande: { nome: 'Poção grande', preco: 60, tipo: 'consumivel', cura: 100 },
    espada: { nome: 'Espada de ferro', preco: 100, tipo: 'arma', ataque: 5 },
    espada_lunar: { nome: 'Espada lunar', preco: 280, tipo: 'arma', ataque: 12 },
    escudo: { nome: 'Escudo de ferro', preco: 120, tipo: 'armadura', defesa: 4 },
    escudo_real: { nome: 'Escudo real', preco: 320, tipo: 'armadura', defesa: 9 },
    liberador: { nome: 'Liberador de poder', preco: 650, tipo: 'consumivel', efeito: 'roleta' }
};

function obterJogadorRPG(id, nome) {
    if (!dadosRPG[id]) {
        dadosRPG[id] = {
            nome, nivel: 1, xp: 0, moedas: 50,
            hp: 100, hpMax: 100, ataque: 10, defesa: 2, pontosEvolucao: 0, evolucoes: { ataque: 0, defesa: 0, vida: 0, magia: 0 },
            inventario: { pocao: 2, liberador: 0 }, equipamento: { arma: null, armadura: null },
            magias: [], poderCopiado: null, zumbi: null,
            inimigo: null, progresso: { exploracoes: 0, vitorias: 0, missoesConcluidas: 0 },
            missao: { tipo: 'explorar', meta: 3, progresso: 0, recompensa: 45, xp: 35 }
        };
    }
    const p = dadosRPG[id];
    p.nome = nome || p.nome || nomeExibicao(id);
    p.nivel = Math.max(1, Number(p.nivel) || 1);
    p.xp = Math.max(0, Number(p.xp) || 0);
    p.moedas = Math.max(0, Number(p.moedas) || 0);
    p.hpMax = Math.max(100, Number(p.hpMax) || (100 + (p.nivel - 1) * 15));
    p.hp = Math.max(0, Math.min(p.hpMax, Number(p.hp ?? p.hpMax)));
    p.ataque = Math.max(10, Number(p.ataque) || 10);
    p.defesa = Math.max(2, Number(p.defesa) || 2);
    if (p.pontosEvolucao === undefined || p.pontosEvolucao === null) p.pontosEvolucao = Math.max(0, p.nivel - 1);
    p.pontosEvolucao = Math.max(0, Number(p.pontosEvolucao) || 0);
    p.evolucoes ||= { ataque: 0, defesa: 0, vida: 0, magia: 0 };
    for (const chave of ['ataque','defesa','vida','magia']) p.evolucoes[chave] = Math.max(0, Number(p.evolucoes[chave]) || 0);
    p.inventario ||= { pocao: 0 };
    p.inventario.liberador = Math.max(0, Number(p.inventario.liberador) || 0);
    p.equipamento ||= { arma: null, armadura: null };
    if (!Array.isArray(p.magias)) p.magias = [];
    p.poderCopiado ||= null;
    p.zumbi ||= null;
    p.progresso ||= { exploracoes: 0, vitorias: 0, missoesConcluidas: 0 };
    p.missao ||= { tipo: 'explorar', meta: 3, progresso: 0, recompensa: 45, xp: 35 };
    return p;
}

async function salvarRPG() {
    await salvarJSON(ARQUIVO_RPG, dadosRPG);
}

function xpNecessarioRPG(nivel) {
    return 70 + Math.max(0, nivel - 1) * 25;
}

async function adicionarXPRPG(jogador, ganho) {
    jogador.xp += Math.max(0, Number(ganho) || 0);
    const subidas = [];
    while (jogador.xp >= xpNecessarioRPG(jogador.nivel)) {
        jogador.xp -= xpNecessarioRPG(jogador.nivel);
        jogador.nivel++;
        jogador.pontosEvolucao = (Number(jogador.pontosEvolucao) || 0) + 1;
        jogador.hpMax += 15;
        jogador.ataque += 2;
        jogador.defesa += 1;
        jogador.hp = jogador.hpMax;
        subidas.push(jogador.nivel);
    }
    return subidas;
}

const RPG_MAGIAS = {
    bola_de_fogo: {
        nome: 'Bola de fogo', raridade: 'Comum', chance: 30,
        descricao: 'Cria uma esfera flamejante de 1 m × 1 m.',
        poder: 'ataque'
    },
    agua: {
        nome: 'Água', raridade: 'Comum', chance: 25,
        descricao: 'Cria e move até 1 m × 1 m de água.',
        poder: 'defesa'
    },
    plantificar: {
        nome: 'Plantificar', raridade: 'Incomum', chance: 18,
        descricao: 'Cria e controla uma planta.',
        poder: 'controle'
    },
    copia_sangrenta: {
        nome: 'Cópia sangrenta', raridade: 'Raro', chance: 12,
        descricao: 'Copia temporariamente uma habilidade de um inimigo derrotado.',
        poder: 'copia'
    },
    necromancia: {
        nome: 'Necromancia', raridade: 'Épico', chance: 8,
        descricao: 'Invoca como aliado um zumbi de um inimigo derrotado.',
        poder: 'invocacao'
    },
    pacto_da_lua: {
        nome: 'Pacto da lua', raridade: 'Lendário', chance: 3.5,
        descricao: 'De dia: -12% de poder. À noite: +20% de poder.',
        poder: 'pacto'
    },
    pacto_do_sol: {
        nome: 'Pacto do sol', raridade: 'Lendário', chance: 3.5,
        descricao: 'De dia: +20% de poder. À noite: -12% de poder.',
        poder: 'pacto'
    }
};

function sortearMagiaRPG(magiasAdquiridas = []) {
    const adquiridas = new Set(magiasAdquiridas);
    const disponiveis = Object.entries(RPG_MAGIAS).filter(([id]) => !adquiridas.has(id));
    if (!disponiveis.length) return null;
    const total = disponiveis.reduce((soma, [, magia]) => soma + magia.chance, 0);
    let sorteio = Math.random() * total;
    for (const [id, magia] of disponiveis) {
        sorteio -= magia.chance;
        if (sorteio <= 0) return { id, ...magia };
    }
    const [id, magia] = disponiveis.at(-1);
    return { id, ...magia };
}

function obterMultiplicadorMagiaRPG(j) {
    const pacto = j.magias.find(id => id === 'pacto_da_lua' || id === 'pacto_do_sol');
    if (!pacto) return 1 + (Math.max(0, Number(j.evolucoes?.magia) || 0) * 0.05);
    const bonusEvolucao = 1 + (Math.max(0, Number(j.evolucoes?.magia) || 0) * 0.05);
    const hora = new Date().getHours();
    const dia = hora >= 7 && hora < 18;
    if (pacto === 'pacto_da_lua') return (dia ? 0.88 : 1.20) * bonusEvolucao;
    return (dia ? 1.20 : 0.88) * bonusEvolucao;
}

function listarMagiasRPG(j) {
    const adquiridas = new Set(j.magias);
    return `🔮 *MAGIAS DO RPG*\n\n${Object.entries(RPG_MAGIAS).map(([id, magia]) =>
        `${adquiridas.has(id) ? '✅' : '🔒'} *${magia.nome}* — ${magia.raridade}\n${magia.descricao}\nChance base na roleta: ${String(magia.chance).replace('.', ',')}%`
    ).join('\n\n')}\n\n🎲 Use !rpg usar_liberador para consumir um Liberador de poder. Poderes já desbloqueados saem da roleta; as chances são redistribuídas.`;
}

async function usarMagiaRPG(j, nomeMagia) {
    const chave = normalizar(nomeMagia).replace(/\s+/g, '_');
    const magia = RPG_MAGIAS[chave];
    if (!magia) return 'Magia não reconhecida. Use !rpg magias.';
    if (!j.magias.includes(chave)) return 'Você ainda não desbloqueou essa magia. Use um Liberador de poder.';
    if (j.hp <= 0) return 'Seu personagem precisa estar vivo para conjurar.';
    if (chave === 'bola_de_fogo') {
        if (!j.inimigo) return 'Bola de fogo: não há inimigo em combate. Explore primeiro.';
        const dano = Math.max(1, Math.round((j.ataque * 2.4 + 18) * obterMultiplicadorMagiaRPG(j)));
        j.inimigo.hp -= dano;
        if (j.inimigo.hp <= 0) {
            const derrotado = j.inimigo;
            j.inimigo = null;
            j.ultimoInimigoDerrotado = { nome: derrotado.nome, ataque: derrotado.ataque, habilidade: derrotado.habilidade || 'Ataque especial', xp: derrotado.xp, moedas: derrotado.moedas };
            j.progresso.vitorias++;
            j.missao.progresso = j.missao.tipo === 'vencer' ? j.missao.progresso + 1 : j.missao.progresso;
            j.moedas += derrotado.moedas;
            await adicionarXPRPG(j, derrotado.xp);
            return `🔥 Bola de fogo atingiu ${derrotado.nome} e causou ${dano} de dano!\n🏆 Inimigo derrotado. +${derrotado.xp} XP e +${derrotado.moedas} moedas RPG.`;
        }
        return `🔥 Você criou uma bola de fogo de 1 m × 1 m!\n💥 Dano: ${dano}\n👹 ${j.inimigo.nome}: ${j.inimigo.hp}/${j.inimigo.hpMax} HP.`;
    }
    if (chave === 'agua') {
        const cura = Math.round(20 * obterMultiplicadorMagiaRPG(j));
        const antes = j.hp;
        j.hp = Math.min(j.hpMax, j.hp + cura);
        if (j.inimigo) j.inimigo.proximoAtaqueReduzido = true;
        return `💧 Você criou e moveu água em uma área de 1 m × 1 m.\n🛡️ A água desviou parte do perigo e recuperou ${j.hp - antes} HP.`;
    }
    if (chave === 'plantificar') {
        const cura = Math.round(30 * obterMultiplicadorMagiaRPG(j));
        const antes = j.hp;
        j.hp = Math.min(j.hpMax, j.hp + cura);
        if (j.inimigo) j.inimigo.atordoado = true;
        return `🌿 Você fez uma planta crescer e a controlou!\n❤️ Recuperou ${j.hp - antes} HP. ${j.inimigo ? 'A planta também prendeu o inimigo por uma rodada.' : ''}`;
    }
    if (chave === 'copia_sangrenta') {
        if (!j.ultimoInimigoDerrotado) return '🩸 Derrote um inimigo primeiro. Depois use Cópia sangrenta para copiar uma habilidade dele.';
        j.poderCopiado = { ...j.ultimoInimigoDerrotado, ate: Date.now() + 10 * 60 * 1000 };
        return `🩸 Você copiou *${j.poderCopiado.habilidade || 'a habilidade especial'}* de ${j.poderCopiado.nome}! Seu próximo ataque recebe o poder copiado como bônus.`;
    }
    if (chave === 'necromancia') {
        if (!j.ultimoInimigoDerrotado) return '☠️ Derrote um inimigo primeiro para ter um corpo disponível para a invocação.';
        j.zumbi = { nome: `Zumbi de ${j.ultimoInimigoDerrotado.nome}`, ataque: Math.max(4, Math.round(j.ultimoInimigoDerrotado.ataque * 0.7)), vida: 3 };
        return `☠️ *NECROMANCIA!*\n${j.zumbi.nome} foi invocado como aliado. Ele lutará ao seu lado por até 3 turnos.`;
    }
    if (chave === 'pacto_da_lua' || chave === 'pacto_do_sol') {
        const multiplicador = obterMultiplicadorMagiaRPG(j);
        const fase = new Date().getHours() >= 7 && new Date().getHours() < 18 ? 'dia' : 'noite';
        return `🌙 Você ativou ${magia.nome}.\n☀️ Período atual: ${fase}.\n⚡ Poder atual: ${Math.round(multiplicador * 100)}% (bônus/penalidade aplicado automaticamente).`;
    }
    return 'Magia não disponível.';
}

function statusRPG(j) {
    return `🧭 *${j.nome.toUpperCase()} — AVENTUREIRO*\n\n⭐ Nível: ${j.nivel}\n✨ XP: ${j.xp}/${xpNecessarioRPG(j.nivel)}\n❤️ Vida: ${j.hp}/${j.hpMax}\n⚔️ Ataque: ${j.ataque}\n🛡️ Defesa: ${j.defesa}\n🌳 Pontos de evolução: ${j.pontosEvolucao||0}\n🪙 Moedas RPG: ${j.moedas}\n🔮 Magias: ${j.magias.length ? j.magias.map(id => RPG_MAGIAS[id]?.nome || id).join(', ') : 'Nenhuma'}\n⚡ Poder atual: ${Math.round(obterMultiplicadorMagiaRPG(j) * 100)}%\n☠️ Aliado: ${j.zumbi ? `${j.zumbi.nome} (${j.zumbi.vida} turnos)` : 'Nenhum'}\n\n🏆 Vitórias: ${j.progresso.vitorias}\n🗺️ Explorações: ${j.progresso.exploracoes}\n📜 Missões concluídas: ${j.progresso.missoesConcluidas}\n⚔️ Combate: ${j.inimigo ? j.inimigo.nome + ' (' + j.inimigo.hp + ' HP)' : 'Nenhum'}`;
}

function svgTexto(texto) { return escaparSVG(texto); }

async function gerarImagemArvoreRPG(j) {
    const r = j.evolucoes || { ataque:0, defesa:0, vida:0, magia:0 };
    const nos = [
        { x:160, y:250, cor:'#ff6b45', nome:'ATAQUE', nivel:r.ataque||0, desc:'+3 ATK / ponto' },
        { x:400, y:250, cor:'#54a7ff', nome:'DEFESA', nivel:r.defesa||0, desc:'+2 DEF / ponto' },
        { x:640, y:250, cor:'#54d69a', nome:'VIDA', nivel:r.vida||0, desc:'+15 HP / ponto' },
        { x:400, y:470, cor:'#c18aff', nome:'MAGIA', nivel:r.magia||0, desc:'+5% poder / ponto' }
    ];
    const cards = nos.map(n => `<path d="M400 125 L${n.x} ${n.y-55}" stroke="${n.cor}" stroke-width="5" opacity=".75"/><rect x="${n.x-105}" y="${n.y-55}" width="210" height="125" rx="20" fill="#17243d" stroke="${n.cor}" stroke-width="4"/><circle cx="${n.x}" cy="${n.y-20}" r="18" fill="${n.cor}"/><text x="${n.x}" y="${n.y+15}" text-anchor="middle" fill="#fff" font-size="20" font-weight="bold">${n.nome}</text><text x="${n.x}" y="${n.y+42}" text-anchor="middle" fill="#d8e4ff" font-size="16">Nível ${n.nivel} • ${n.desc}</text>`).join('');
    const svg = `<svg width="800" height="620" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#10182c"/><stop offset="1" stop-color="#202c4a"/></linearGradient></defs><rect width="800" height="620" fill="url(#bg)"/><text x="400" y="55" text-anchor="middle" fill="#fff" font-size="32" font-weight="bold">ÁRVORE DE EVOLUÇÃO</text><text x="400" y="88" text-anchor="middle" fill="#b8c8e8" font-size="18">${svgTexto(j.nome)} • Nível ${j.nivel}</text><rect x="290" y="105" width="220" height="65" rx="18" fill="#26385b" stroke="#f5d36b" stroke-width="3"/><text x="400" y="132" text-anchor="middle" fill="#f5d36b" font-size="17" font-weight="bold">NÚCLEO</text><text x="400" y="154" text-anchor="middle" fill="#fff" font-size="15">${j.pontosEvolucao||0} ponto(s) disponível(is)</text>${cards}<text x="400" y="580" text-anchor="middle" fill="#d8e4ff" font-size="17">!rpg evoluir ataque | defesa | vida | magia</text></svg>`;
    return sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

async function evoluirRPG(j, ramo) {
    const chave = normalizar(ramo);
    if (!['ataque','defesa','vida','magia'].includes(chave)) return 'Ramo inválido. Escolha: ataque, defesa, vida ou magia.';
    if (j.pontosEvolucao < 1) return 'Você não tem pontos de evolução. Ganhe níveis no RPG para receber 1 ponto por nível.';
    j.pontosEvolucao--;
    j.evolucoes[chave] = (j.evolucoes[chave] || 0) + 1;
    if (chave === 'ataque') j.ataque += 3;
    if (chave === 'defesa') j.defesa += 2;
    if (chave === 'vida') { j.hpMax += 15; j.hp += 15; }
    await salvarRPG();
    const efeitos = { ataque: '+3 de ataque', defesa: '+2 de defesa', vida: '+15 de HP máximo e atual', magia: '+5% de poder mágico' };
    return `🌳 *EVOLUÇÃO CONCLUÍDA*\n\nRamo: ${chave.toUpperCase()}\nBônus: ${efeitos[chave]}\nNível do ramo: ${j.evolucoes[chave]}\nPontos restantes: ${j.pontosEvolucao}`;
}

function criarImagemRoletaPremio(premio, nome) {
    const fatias = ['#e85d75','#e9b949','#3cba92','#4f8fe8','#a879e8','#ed8b45'];
    const rotulos = ['10','25','50','75','100','150'];
    const setores = rotulos.map((v,i) => { const a1=i*Math.PI/3, a2=(i+1)*Math.PI/3; const x1=400+230*Math.sin(a1), y1=300-230*Math.cos(a1); const x2=400+230*Math.sin(a2), y2=300-230*Math.cos(a2); const tx=400+145*Math.sin((i+.5)*Math.PI/3), ty=300-145*Math.cos((i+.5)*Math.PI/3); return `<path d="M400 300 L${x1} ${y1} A230 230 0 0 1 ${x2} ${y2} Z" fill="${fatias[i]}" stroke="#fff" stroke-width="4"/><text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="30" font-weight="bold">${v}</text>`; }).join('');
    const svg = `<svg width="800" height="700" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="700" fill="#10182c"/><text x="400" y="55" text-anchor="middle" fill="#fff" font-size="34" font-weight="bold">RODA DA SORTE WABOT</text><text x="400" y="88" text-anchor="middle" fill="#c8d6f0" font-size="18">Giro diário gratuito • sem apostas</text><g>${setores}</g><path d="M400 42 L375 95 L425 95 Z" fill="#fff" stroke="#f5d36b" stroke-width="4"/><circle cx="400" cy="300" r="48" fill="#17243d" stroke="#fff" stroke-width="5"/><text x="400" y="310" text-anchor="middle" fill="#fff" font-size="25" font-weight="bold">W</text><rect x="115" y="570" width="570" height="80" rx="20" fill="#26385b"/><text x="400" y="605" text-anchor="middle" fill="#f5d36b" font-size="22" font-weight="bold">${svgTexto(nome)} ganhou</text><text x="400" y="635" text-anchor="middle" fill="#fff" font-size="25">+${premio} WACoins</text></svg>`;
    return sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

async function executarRoletaGratuita(sock, jid, id, nome) {
    const hoje = dataLocalISO();
    const r = sistemasV310.recompensasDiarias[id] ||= {};
    if (r.roletaDia === hoje) { await texto(sock,jid,'🎡 Você já girou a Roda da Sorte hoje. Volte após a virada do dia.'); return; }
    const premios = [10,25,50,75,100,150];
    const premio = premios[randomInt(0,premios.length)];
    r.roletaDia = hoje;
    await adicionarWACoins(id,nome,premio);
    await salvarSistemas310();
    const imagem = criarImagemRoletaPremio(premio,nome);
    await enviar(sock,jid,{image:imagem,caption:`🎡 *RODA DA SORTE*\n\nVocê recebeu *${formatarWACoins(premio)}*!\nGiro diário gratuito. Não há custo nem possibilidade de perder moedas.`});
}

async function renascerPesca(sock, jid, id, nome) {
    const p = obterDadosPescador(id,nome);
    const requisito = 500;
    if ((p.renascimentos || 0) >= 20) { await texto(sock,jid,'🏆 Você atingiu o limite de 20 renascimentos da pesca e já possui todos os bônus permanentes.'); return; }
    if (p.capturas < requisito) { await texto(sock,jid,`🌊 *RENASCIMENTO DA PESCA*\n\nRequisito: ${requisito} capturas.\nSeu progresso: ${p.capturas}/${requisito}.\n\nAo renascer, coleção, capturas e equipamentos serão reiniciados; seus WACoins não serão alterados. Você mantém os bônus de renascimento.`); return; }
    const confirmacao = (p.renascimentos || 0) + 1;
    const novo = { nome:p.nome, moedas:0, capturas:0, maiorPeixe:0, peixes:[], itensEvento:[], bonusSorteEvento:0, renascimentos:confirmacao, bonusSorteRenascimento:Math.min(20,(p.bonusSorteRenascimento||0)+1), bonusPesoRenascimento:Math.min(1,(p.bonusPesoRenascimento||0)+0.05), equipamentos:{vara:'basica',isca:'comum',linha:0,amuleto:0,anel:0,relicario:0,pingente:0,acelerador:0,peso:0} };
    dadosPesca[id] = novo;
    cooldownPesca.delete(id);
    await salvarDadosPesca();
    await texto(sock,jid,`🌟 *RENASCIMENTO ${confirmacao} CONCLUÍDO!*\n\nSua pesca voltou ao início.\n🍀 Bônus permanente de sorte: +${novo.bonusSorteRenascimento}\n⚖️ Bônus permanente de peso: +${Math.round(novo.bonusPesoRenascimento*100)}%\n\nSeus WACoins foram preservados. Próximo renascimento: mais ${requisito} capturas.`);
}

function parseDuracaoReset(valor) {
    const m = String(valor||'').toLowerCase().match(/^(\d+)(m|h|d)$/);
    if (!m) return 0;
    const n = Number(m[1]);
    const mult = m[2] === 'm' ? 60000 : m[2] === 'h' ? 3600000 : 86400000;
    return n * mult;
}

async function resetarSistema(tipo) {
    const agora = Date.now();
    const sufixo = new Date(agora).toISOString().replace(/[:.]/g,'-');
    if (tipo === 'rpg' || tipo === 'ambos') await writeFile(path.join(DIRETORIO,`backup-reset-rpg-${sufixo}.json`),JSON.stringify(dadosRPG,null,2),'utf8');
    if (tipo === 'pesca' || tipo === 'ambos') await writeFile(path.join(DIRETORIO,`backup-reset-pesca-${sufixo}.json`),JSON.stringify(dadosPesca,null,2),'utf8');
    if (tipo === 'rpg' || tipo === 'ambos') {
        dadosRPG = {};
        sistemasV310.mercado = [];
        sistemasV310.guildas = {};
        sistemasV310.membrosGuilda = {};
        sistemasV310.chefes = {};
        sistemasV310.desafiosPVP = {};
        await salvarRPG();
    }
    if (tipo === 'pesca' || tipo === 'ambos') {
        for (const [id, antigo] of Object.entries(dadosPesca)) {
            const nome = antigo?.nome || nomeExibicao(id);
            dadosPesca[id] = { nome, moedas:0, capturas:0, maiorPeixe:0, peixes:[], itensEvento:[], bonusSorteEvento:0, renascimentos:Number(antigo?.renascimentos)||0, bonusSorteRenascimento:Number(antigo?.bonusSorteRenascimento)||0, bonusPesoRenascimento:Number(antigo?.bonusPesoRenascimento)||0, equipamentos:{vara:'basica',isca:'comum',linha:0,amuleto:0,anel:0,relicario:0,pingente:0,acelerador:0,peso:0} };
        }
        cooldownPesca.clear();
        pescariasEmAndamento.clear();
        await salvarDadosPesca();
    }
    sistemasV310.resetHistorico ||= [];
    sistemasV310.resetHistorico.push({ tipo, data: new Date(agora).toISOString(), automatico: true });
    sistemasV310.resetHistorico = sistemasV310.resetHistorico.slice(-100);
    await salvarSistemas310();
    return agora;
}

async function processarAgendamentoReset(sock, jid, msg, args) {
    if (!await remetenteEhAdminBot(sock,msg)) return '⛔ Apenas administradores configurados podem agendar resets.';
    const acao = normalizar(args[0]||'status');
    const agendas = sistemasV310.resetAgendado ||= {}; sistemasV310.resetHistorico ||= [];
    if (acao === 'status') {
        const linhas = Object.entries(agendas).map(([tipo,a])=>`• ${tipo}: a cada ${a.intervaloTexto}, próximo em ${new Date(a.proximoReset).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}`);
        return `🗓️ *RESETS AGENDADOS*\n\n${linhas.join('\n') || 'Nenhum reset agendado.'}\n\n!resetagendar rpg|pesca|ambos 7d\n!resetagendar cancelar rpg`;
    }
    if (acao === 'cancelar') {
        const tipo = normalizar(args[1]||'');
        if (!agendas[tipo]) return 'Não existe agendamento desse tipo.';
        delete agendas[tipo]; await salvarSistemas310();
        return `✅ Agendamento de reset ${tipo} cancelado.`;
    }
    const tipo = acao;
    if (!['rpg','pesca','ambos'].includes(tipo)) return 'Tipo inválido. Use rpg, pesca ou ambos.';
    const intervalo = parseDuracaoReset(args[1]);
    if (!intervalo || intervalo < 3600000 || intervalo > 365*86400000) return 'Intervalo inválido. Use de 1h até 365d. Exemplo: !resetagendar rpg 7d';
    agendas[tipo] = { intervalo, intervaloTexto:args[1], proximoReset:Date.now()+intervalo, jid };
    await salvarSistemas310();
    return `✅ Reset ${tipo} agendado para repetir a cada ${args[1]}.\nPróximo reset: ${new Date(agendas[tipo].proximoReset).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}\nUse !resetagendar status para consultar ou !resetagendar cancelar ${tipo} para cancelar.`;
}

function iniciarAgendadorResets(sock) {
    if (timerResetAgendado) clearInterval(timerResetAgendado);
    timerResetAgendado = setInterval(async () => {
        try {
            const agora = Date.now();
            for (const [tipo, agenda] of Object.entries(sistemasV310.resetAgendado || {})) {
                if (!agenda?.proximoReset || agora < agenda.proximoReset) continue;
                await resetarSistema(tipo);
                agenda.proximoReset = Date.now() + Number(agenda.intervalo || 86400000);
                await salvarSistemas310();
                if (agenda.jid) await texto(sock,agenda.jid,`♻️ *RESET AUTOMÁTICO CONCLUÍDO*\n\nSistema: ${tipo.toUpperCase()}\nPróximo reset: ${new Date(agenda.proximoReset).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}\nBônus de renascimento da pesca foram preservados.`);
            }
        } catch (e) { console.error('[RESET AGENDADO]',e); }
    },15000);
}

async function processarRPG(id, nome, args) {
    const acao = normalizar(args[0] || 'status');
    const j = obterJogadorRPG(id, nome);
    let msg = '';

    if (acao === 'iniciar') {
        await salvarRPG();
        return `🧭 *SUA AVENTURA COMEÇOU!*\n\n${statusRPG(j)}\n\nUse !rpg explorar para iniciar sua jornada.`;
    }
    if (acao === 'status' || acao === 'perfil') {
        await salvarRPG();
        return statusRPG(j);
    }
    if (acao === 'magias' || acao === 'poderes' || acao === 'magia') return listarMagiasRPG(j);
    if (acao === 'evoluir') return evoluirRPG(j,args[1]||'');
    if (acao === 'usar_liberador' || acao === 'liberador') {
        if (Number(j.inventario.liberador || 0) <= 0) return 'Você não possui um Liberador de poder. Compre em !rpg loja.';
        const magia = sortearMagiaRPG(j.magias);
        if (!magia) return '🏆 Você já desbloqueou todas as magias! Não precisa gastar outro Liberador.';
        j.inventario.liberador--;
        j.magias.push(magia.id);
        await salvarRPG();
        return `🎰 *ROLETA DE PODERES*\n\n${Object.entries(RPG_MAGIAS).map(([id, p]) => `${id === magia.id ? '🔻' : '▫️'} ${p.nome}`).join('\n')}\n\n✨ Resultado: *${magia.nome}* (${magia.raridade})\n${magia.descricao}\n\n🎉 Poder desbloqueado permanentemente!\n🔮 Magias: ${j.magias.length}/${Object.keys(RPG_MAGIAS).length}`;
    }
    if (acao === 'conjurar' || acao === 'usar_magia') {
        const nomePoder = args.slice(1).join('_');
        const resultado = await usarMagiaRPG(j, nomePoder);
        if (!resultado.startsWith('Magia não reconhecida') && !resultado.startsWith('Você ainda não')) registrarProgressoMissoes(id,'conjurar',1);
        await salvarRPG(); await salvarSistemas310();
        return resultado;
    }

    if (acao === 'explorar') {
        if (j.hp <= 0) return '💤 Seu personagem está sem vida. Use !rpg descansar para recuperar 50% da vida.';
        j.progresso.exploracoes++;
        registrarProgressoMissoes(id, 'explorar', 1);
        j.missao.progresso = j.missao.tipo === 'explorar' ? j.missao.progresso + 1 : j.missao.progresso;
        const encontro = randomInt(1, 101);
        if (encontro <= 65) {
            const base = aleatorio(RPG_INIMIGOS);
            const escala = 1 + (j.nivel - 1) * 0.12;
            j.inimigo = {
                nome: base.nome,
                hp: Math.round(base.hp * escala),
                hpMax: Math.round(base.hp * escala),
                ataque: Math.round(base.ataque * escala),
                defesa: Math.round(base.defesa * escala),
                xp: Math.round(base.xp * escala),
                moedas: Math.round(base.moedas * escala),
                habilidade: base.habilidade,
                estilo: base.estilo || aleatorio(['agressivo', 'tatico', 'arcano', 'venenoso']),
                turno: 0
            };
            msg = `🌲 Você explorou uma região desconhecida e encontrou *${j.inimigo.nome}*!\n❤️ Inimigo: ${j.inimigo.hp} HP\n\nUse !rpg atacar para lutar ou !rpg fugir para recuar.`;
        } else if (encontro <= 85) {
            const moedas = randomInt(12, 36);
            const xp = randomInt(8, 19);
            j.moedas += moedas;
            const subidas = await adicionarXPRPG(j, xp);
            msg = `🎒 Você encontrou um baú abandonado!\n🪙 +${moedas} moedas RPG\n✨ +${xp} XP${subidas.length ? '\n⭐ Subiu para o nível ' + subidas.join(', ') + '!' : ''}`;
        } else {
            const cura = Math.min(j.hpMax - j.hp, 25);
            j.hp += cura;
            msg = `🌿 Você encontrou uma fonte tranquila e recuperou ${cura} HP.`;
        }
        await salvarRPG(); await salvarSistemas310();
        return msg;
    }

    if (acao === 'atacar') {
        if (!j.inimigo) return 'Não há inimigo ativo. Use !rpg explorar.';
        const multiplicador = obterMultiplicadorMagiaRPG(j);
        const bonusCopia = j.poderCopiado && Date.now() < j.poderCopiado.ate
            ? Math.max(3, Math.round(j.poderCopiado.ataque * 0.55)) : 0;
        const dano = Math.max(1, Math.round((j.ataque + randomInt(0, 7) + bonusCopia) * multiplicador) - j.inimigo.defesa);
        j.inimigo.hp -= dano;
        let danoZumbi = 0;
        if (j.zumbi && j.zumbi.vida > 0 && j.inimigo.hp > 0) {
            danoZumbi = j.zumbi.ataque;
            j.inimigo.hp -= danoZumbi;
            j.zumbi.vida--;
            if (j.zumbi.vida <= 0) j.zumbi = null;
        }
        if (bonusCopia > 0) j.poderCopiado = null;
        if (j.inimigo.hp <= 0) {
            const inimigo = j.inimigo;
            j.ultimoInimigoDerrotado = { nome: inimigo.nome, ataque: inimigo.ataque, habilidade: inimigo.habilidade || 'Ataque especial', xp: inimigo.xp, moedas: inimigo.moedas };
            j.inimigo = null;
            j.progresso.vitorias++;
            registrarProgressoMissoes(id, 'vencer', 1);
            j.moedas += inimigo.moedas;
            const subidas = await adicionarXPRPG(j, inimigo.xp);
            j.missao.progresso = j.missao.tipo === 'vencer' ? j.missao.progresso + 1 : j.missao.progresso;
            msg = `⚔️ Você derrotou *${inimigo.nome}*!\n💥 Dano final: ${dano}\n✨ +${inimigo.xp} XP\n🪙 +${inimigo.moedas} moedas RPG${subidas.length ? '\n⭐ Novo nível: ' + subidas.join(', ') : ''}`;
        } else {
            j.inimigo.turno = (Number(j.inimigo.turno)||0)+1;
            const estilo = j.inimigo.estilo || 'agressivo';
            let recebido = Math.max(1, j.inimigo.ataque + randomInt(0, 4) - j.defesa);
            let formaAtaque = '💢 O inimigo executou um ataque direto.';
            if (estilo === 'agressivo' && j.inimigo.turno % 3 === 0) { recebido = Math.round(recebido * 1.65); formaAtaque = '💥 Investida brutal! O inimigo aumentou o dano.'; }
            else if (estilo === 'tatico' && j.inimigo.turno % 2 === 0) { recebido = Math.round(recebido * 1.2); formaAtaque = '🎯 Golpe calculado: o inimigo encontrou uma abertura.'; }
            else if (estilo === 'arcano' && j.inimigo.turno % 3 === 0) { recebido = Math.round(recebido * 1.4); formaAtaque = '✨ Rajada arcana! Um ataque mágico atravessou parte da defesa.'; }
            else if (estilo === 'venenoso' && j.inimigo.turno % 2 === 0) { recebido = Math.round(recebido * 1.15); j.venenoTurnos = 2; formaAtaque = '☣️ Ataque venenoso! Você ficou envenenado por 2 turnos.'; }
            let controle = '';
            if (j.inimigo.atordoado) {
                recebido = 0;
                delete j.inimigo.atordoado;
                controle = '\n🌿 A planta manteve o inimigo preso; ele não contra-atacou.';
            } else if (j.inimigo.proximoAtaqueReduzido) {
                recebido = Math.ceil(recebido * 0.4);
                delete j.inimigo.proximoAtaqueReduzido;
                controle = '\n💧 A água desviou parte do golpe.';
            }
            j.hp = Math.max(0, j.hp - recebido);
            if (j.venenoTurnos > 0) { const veneno = Math.min(j.hp, 5); j.hp -= veneno; j.venenoTurnos--; controle += `\n☣️ Veneno: -${veneno} HP.`; }
            msg = `${formaAtaque}\n⚔️ Você causou ${dano} de dano${bonusCopia ? ` (inclui Cópia sangrenta: ${j.ultimoInimigoDerrotado?.habilidade || 'poder copiado'})` : ''}${danoZumbi ? ` + ${danoZumbi} do zumbi` : ''}.\n👹 ${j.inimigo.nome}: ${Math.max(0, j.inimigo.hp)}/${j.inimigo.hpMax} HP\n💢 Dano recebido: ${recebido}.\n❤️ Sua vida: ${j.hp}/${j.hpMax}${controle}`;
            if (j.hp <= 0) {
                j.inimigo = null;
                j.hp = Math.max(1, Math.floor(j.hpMax * 0.35));
                msg += '\n\n💤 Você foi derrotado e voltou ao acampamento com 35% da vida.';
            }
        }
        await salvarRPG(); await salvarSistemas310();
        return msg;
    }

    if (acao === 'fugir') {
        if (!j.inimigo) return 'Não há combate ativo.';
        j.inimigo = null;
        await salvarRPG();
        return '🏃 Você conseguiu recuar. O combate foi encerrado.';
    }

    if (acao === 'curar' || acao === 'pocao') {
        const chave = args[1] || 'pocao';
        const item = RPG_ITENS[chave];
        if (!item?.cura || Number(j.inventario[chave] || 0) <= 0) return `Você não possui ${item?.nome || 'essa poção'}. Compre na !rpg loja.`;
        const antes = j.hp;
        j.hp = Math.min(j.hpMax, j.hp + item.cura);
        j.inventario[chave]--;
        await salvarRPG();
        return `🧪 ${item.nome} utilizada. Recuperou ${j.hp - antes} HP.\n❤️ Vida: ${j.hp}/${j.hpMax}`;
    }

    if (acao === 'descansar') {
        if (j.inimigo) return 'Não pode descansar durante um combate. Use !rpg fugir primeiro.';
        const antes = j.hp;
        j.hp = Math.min(j.hpMax, j.hp + Math.ceil(j.hpMax * 0.5));
        await salvarRPG();
        return `⛺ Você descansou e recuperou ${j.hp - antes} HP.\n❤️ Vida: ${j.hp}/${j.hpMax}`;
    }

    if (acao === 'loja') {
        return `🏪 *LOJA DO RPG — MOEDAS RPG*\n\n${Object.entries(RPG_ITENS).map(([id, item]) => `• *${id}* — ${item.nome}: ${item.preco} moedas`).join('\n')}\n\nComprar: !rpg comprar ID`;
    }

    if (acao === 'comprar') {
        const itemId = normalizar(args[1] || '').replace(/ /g, '_');
        const item = RPG_ITENS[itemId];
        if (!item) return 'Item inválido. Use !rpg loja.';
        if (j.moedas < item.preco) return `Moedas RPG insuficientes. Você tem ${j.moedas}.`;
        j.moedas -= item.preco;
        j.inventario[itemId] = (Number(j.inventario[itemId]) || 0) + 1;
        await salvarRPG();
        return `✅ Comprou ${item.nome}.\n🪙 Saldo RPG: ${j.moedas}`;
    }

    if (acao === 'inventario') {
        const itens = Object.entries(j.inventario).filter(([, q]) => Number(q) > 0);
        return `🎒 *INVENTÁRIO RPG*\n\n${itens.length ? itens.map(([id, q]) => `• ${RPG_ITENS[id]?.nome || id}: ${q}`).join('\n') : 'Vazio.'}`;
    }

    if (acao === 'missao') {
        if (j.missao.progresso >= j.missao.meta) {
            j.moedas += j.missao.recompensa;
            const subidas = await adicionarXPRPG(j, j.missao.xp);
            j.progresso.missoesConcluidas++;
            j.missao = { tipo: 'explorar', meta: 3, progresso: 0, recompensa: 45, xp: 35 };
            await salvarRPG();
            return `🏅 Missão concluída!\n🪙 +45 moedas RPG\n✨ +35 XP${subidas.length ? '\n⭐ Nível: ' + j.nivel : ''}\nNova missão: explore 3 vezes.`;
        }
        await salvarRPG();
        return `📜 *MISSÃO ATUAL*\nExplore ${j.missao.meta} vezes.\nProgresso: ${j.missao.progresso}/${j.missao.meta}\nRecompensa: ${j.missao.recompensa} moedas RPG + ${j.missao.xp} XP.`;
    }

    if (acao === 'equipar') {
        const itemId = normalizar(args[1] || '').replace(/ /g, '_');
        const item = RPG_ITENS[itemId];
        if (!item || !['arma', 'armadura'].includes(item.tipo)) return 'Use !rpg equipar espada, espada_lunar, escudo ou escudo_real.';
        if (Number(j.inventario[itemId] || 0) <= 0) return 'Você não possui esse equipamento.';
        const slot = item.tipo;
        const anterior = j.equipamento[slot];
        if (anterior && RPG_ITENS[anterior]) {
            j[slot === 'arma' ? 'ataque' : 'defesa'] -= RPG_ITENS[anterior][slot === 'arma' ? 'ataque' : 'defesa'];
        }
        j.equipamento[slot] = itemId;
        j[slot === 'arma' ? 'ataque' : 'defesa'] += item[slot === 'arma' ? 'ataque' : 'defesa'];
        await salvarRPG();
        return `🛡️ Equipamento ${item.nome} equipado.\n⚔️ Ataque: ${j.ataque}\n🛡️ Defesa: ${j.defesa}`;
    }

    return 'Comando RPG não reconhecido. Use !helpRPG.';
}


// ==================================================
// SISTEMAS V3.1.0 — MERCADO, GUILDAS, CHEFE, PvP E MISSÕES
// ==================================================

function dataLocalISO(data = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(data);
}
function diferencaDias(a, b) {
    if (!a || !b) return 999;
    return Math.round((Date.parse(`${b}T12:00:00-03:00`) - Date.parse(`${a}T12:00:00-03:00`)) / 86400000);
}
async function salvarSistemas310() { await salvarJSON(ARQUIVO_SISTEMAS, sistemasV310); }
function progressoMissoes(id) {
    const hoje = dataLocalISO();
    const agora = new Date();
    const semana = `${agora.getFullYear()}-W${Math.ceil((((Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) - Date.UTC(agora.getFullYear(),0,1))/86400000)+new Date(agora.getFullYear(),0,1).getDay()+1)/7)}`;
    const r = sistemasV310.recompensasDiarias[id] ||= {};
    if (r.missaoDia !== hoje) { r.missaoDia = hoje; r.diarias = { explorar:0, vencer:0, conjurar:0 }; r.diariasResgatadas = false; }
    if (r.missaoSemana !== semana) { r.missaoSemana = semana; r.semanais = { explorar:0, vencer:0, conjurar:0 }; r.semanaisResgatadas = false; }
    return r;
}
function registrarProgressoMissoes(id, tipo, quantidade=1) {
    const r = progressoMissoes(id);
    if (Object.hasOwn(r.diarias, tipo)) r.diarias[tipo] += quantidade;
    if (Object.hasOwn(r.semanais, tipo)) r.semanais[tipo] += quantidade;
}
function mencionarAlvo(msg, args, indice=0) {
    const mencoes = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const digitado = String(args[indice] || '').replace(/[^0-9]/g,'');
    return mencoes[0] || (digitado ? `${digitado}@s.whatsapp.net` : '');
}
function obterItemMercado(jogador, itemId) {
    const id = normalizar(itemId).replace(/\s+/g,'_');
    return RPG_ITENS[id] ? { id, item: RPG_ITENS[id] } : null;
}
async function processarMercado(id, nome, args) {
    const acao = normalizar(args[0] || 'listar');
    if (acao === 'listar' || acao === 'ver') {
        const ativos = sistemasV310.mercado.filter(x => x.status === 'ativo');
        return `🛒 *MERCADO ENTRE JOGADORES*\n\n${ativos.length ? ativos.map(x => `#${x.id} — ${x.nomeItem} x${x.quantidade}\n💰 ${formatarWACoins(x.preco)} | Vendedor: ${x.nomeVendedor}`).join('\n\n') : 'Nenhuma oferta ativa.'}\n\nAnunciar: !mercado vender ID quantidade preco\nComprar: !mercado comprar ID\nCancelar: !mercado cancelar ID\n\nApenas equipamentos e consumíveis do inventário RPG podem ser anunciados. O item fica reservado até a venda ou cancelamento.`;
    }
    if (acao === 'vender') {
        const encontrado = obterItemMercado(obterJogadorRPG(id,nome), args[1]);
        const qtd = Math.floor(Number(args[2])); const preco = Math.round(Number(String(args[3]||'').replace(',','.'))*100)/100;
        if (!encontrado || !Number.isInteger(qtd) || qtd < 1 || !Number.isFinite(preco) || preco <= 0 || preco > 10000000) return 'Use: !mercado vender ID quantidade preco. Ex.: !mercado vender pocao 2 150';
        const j = obterJogadorRPG(id,nome);
        if ((Number(j.inventario[encontrado.id])||0) < qtd) return 'Você não possui essa quantidade no inventário RPG.';
        j.inventario[encontrado.id] -= qtd;
        const oferta = { id: `${Date.now().toString(36)}${randomInt(100,999)}`, vendedor:id, nomeVendedor:nome, itemId:encontrado.id, nomeItem:encontrado.item.nome, quantidade:qtd, preco, status:'ativo', criadoEm:Date.now() };
        sistemasV310.mercado.push(oferta); await salvarRPG(); await salvarSistemas310();
        return `✅ Oferta #${oferta.id} publicada: ${oferta.nomeItem} x${qtd} por ${formatarWACoins(preco)}.`;
    }
    const ofertaId = String(args[1]||''); const oferta = sistemasV310.mercado.find(x => x.id === ofertaId && x.status === 'ativo');
    if (!oferta) return 'Oferta não encontrada ou já encerrada. Use !mercado para listar.';
    if (acao === 'cancelar') {
        if (!mesmoUsuario(oferta.vendedor,id)) return 'Somente o vendedor pode cancelar esta oferta.';
        const vendedor = obterJogadorRPG(oferta.vendedor, oferta.nomeVendedor);
        vendedor.inventario[oferta.itemId] = (Number(vendedor.inventario[oferta.itemId])||0) + oferta.quantidade;
        oferta.status='cancelada'; await salvarRPG(); await salvarSistemas310();
        return `Oferta #${oferta.id} cancelada. Os itens voltaram ao seu inventário.`;
    }
    if (acao === 'comprar') {
        if (mesmoUsuario(oferta.vendedor,id)) return 'Você não pode comprar sua própria oferta.';
        const carteira = obterCarteira(id,nome); const vendedorCarteira = obterCarteira(oferta.vendedor,oferta.nomeVendedor);
        if (carteira.saldo < oferta.preco) return `Saldo insuficiente. Você tem ${formatarWACoins(carteira.saldo)}.`;
        const comprador = obterJogadorRPG(id,nome);
        carteira.saldo = Math.round((carteira.saldo-oferta.preco)*100)/100;
        const taxa = Math.round(oferta.preco*0.05*100)/100;
        vendedorCarteira.saldo = Math.round((vendedorCarteira.saldo+oferta.preco-taxa)*100)/100;
        comprador.inventario[oferta.itemId] = (Number(comprador.inventario[oferta.itemId])||0)+oferta.quantidade;
        oferta.status='vendida'; oferta.comprador=id; oferta.vendidaEm=Date.now();
        await Promise.all([salvarRPG(),salvarWACoins(),salvarSistemas310()]);
        return `✅ Compra concluída!\n${oferta.nomeItem} x${oferta.quantidade} adicionado ao inventário RPG.\nVendedor recebeu ${formatarWACoins(oferta.preco-taxa)} (taxa de 5%).`;
    }
    return 'Use !mercado, !mercado vender, !mercado comprar ou !mercado cancelar.';
}
async function processarGuilda(id,nome,args) {
    const acao=normalizar(args[0]||'status'); const nomeGuilda=args.slice(1).join(' ').trim();
    const gid=sistemasV310.membrosGuilda[id]; const guilda=gid?sistemasV310.guildas[gid]:null;
    if (acao==='criar') {
        if (gid) return 'Você já pertence a uma guilda. Saia dela antes de criar outra.';
        if (nomeGuilda.length<3||nomeGuilda.length>24) return 'Nome de guilda: entre 3 e 24 caracteres. Use !guilda criar nome.';
        const idNova=`G${Date.now().toString(36).toUpperCase()}`;
        sistemasV310.guildas[idNova]={id:idNova,nome:nomeGuilda.replace(/[\n\r]/g,''),lider:id,membros:[id],tesouro:0,convites:{},criadaEm:Date.now()};
        sistemasV310.membrosGuilda[id]=idNova; await salvarSistemas310();
        return `🏰 Guilda *${nomeGuilda}* criada! ID: ${idNova}. Convide: !guilda convidar @pessoa.`;
    }
    if (acao==='entrar') {
        const g=sistemasV310.guildas[String(args[1]||'').toUpperCase()];
        if (!g) return 'Guilda não encontrada. Consulte !guildas.';
        if (gid) return 'Você já está em uma guilda.';
        if (!g.convites?.[id]) return 'Você precisa receber um convite do líder para entrar.';
        delete g.convites[id]; g.membros.push(id); sistemasV310.membrosGuilda[id]=g.id; await salvarSistemas310();
        return `Bem-vindo à guilda *${g.nome}*!`;
    }
    if (acao==='convidar') {
        if (!guilda || guilda.lider!==id) return 'Somente o líder pode convidar membros.';
        const alvo=mencionarAlvo({message:{extendedTextMessage:{contextInfo:{mentionedJid:[]}}}},args,1);
        const numero=String(args[1]||'').replace(/\D/g,''); const alvoFinal=alvo || (numero?`${numero}@s.whatsapp.net`:'');
        if (!alvoFinal || mesmoUsuario(alvoFinal,id) || sistemasV310.membrosGuilda[alvoFinal]) return 'Informe alguém que ainda não esteja em uma guilda: !guilda convidar @pessoa.';
        guilda.convites[alvoFinal]=Date.now(); await salvarSistemas310();
        return `Convite enviado para ${nomeExibicao(alvoFinal)}. A pessoa deve usar !guilda entrar ${guilda.id}.`;
    }
    if (acao==='sair') {
        if (!guilda) return 'Você não está em uma guilda.';
        if (guilda.lider===id && guilda.membros.length>1) return 'O líder precisa transferir a liderança antes de sair.';
        guilda.membros=guilda.membros.filter(x=>!mesmoUsuario(x,id)); delete sistemasV310.membrosGuilda[id];
        if (!guilda.membros.length) delete sistemasV310.guildas[guilda.id];
        await salvarSistemas310(); return 'Você saiu da guilda.';
    }
    if (acao==='doar') {
        if (!guilda) return 'Você não está em uma guilda.';
        const valor=Math.floor(Number(args[1])); const c=obterCarteira(id,nome);
        if (!Number.isInteger(valor)||valor<1||c.saldo<valor) return 'Use !guilda doar quantidade (saldo insuficiente ou valor inválido).';
        c.saldo-=valor; guilda.tesouro+=valor; await Promise.all([salvarWACoins(),salvarSistemas310()]);
        return `🏦 Você contribuiu com ${formatarWACoins(valor)}. Tesouro da guilda: ${formatarWACoins(guilda.tesouro)}.`;
    }
    if (acao==='status' || acao==='ver') return guilda?`🏰 *${guilda.nome}*\nID: ${guilda.id}\nLíder: ${nomeExibicao(guilda.lider)}\nMembros: ${guilda.membros.length}\nTesouro: ${formatarWACoins(guilda.tesouro)}\n\n!guilda convidar @pessoa | !guilda doar valor | !guilda sair`:'Você não está em uma guilda. Use !guildas ou !guilda criar nome.';
    return 'Comandos: !guilda criar nome | !guilda convidar @pessoa | !guilda entrar ID | !guilda sair | !guilda doar valor | !guilda.';
}
function listarGuildas() {
    const lista=Object.values(sistemasV310.guildas).sort((a,b)=>b.membros.length-a.membros.length).slice(0,15);
    return `🏰 *GUILDAS*\n\n${lista.length?lista.map(g=>`• *${g.nome}* — ${g.id} — ${g.membros.length} membro(s)`).join('\n'):'Nenhuma guilda criada.'}\n\nPara entrar, receba convite e use !guilda entrar ID.`;
}
async function processarDiario(id,nome) {
    const hoje=dataLocalISO(); const r=sistemasV310.recompensasDiarias[id] ||= {};
    const diferenca=diferencaDias(r.ultimoDiario,hoje);
    if (r.ultimoDiario===hoje) return `🎁 Você já resgatou sua recompensa hoje.\n🔥 Sequência atual: ${r.sequencia||1} dia(s). Volte amanhã.`;
    r.sequencia=diferenca===1?(Number(r.sequencia)||0)+1:1; r.ultimoDiario=hoje;
    const premio=100+Math.min(r.sequencia-1,14)*25; await adicionarWACoins(id,nome,premio); await salvarSistemas310();
    return `🎁 *RECOMPENSA DIÁRIA*\n\nVocê recebeu ${formatarWACoins(premio)}!\n🔥 Sequência: ${r.sequencia} dia(s)\n${r.sequencia>=7?'🏅 Bônus de consistência desbloqueado!':'Continue voltando diariamente para aumentar o prêmio.'}`;
}
function mostrarMissoes(id) {
    const r=progressoMissoes(id); const d=r.diarias; const w=r.semanais;
    return `📜 *MISSÕES DIÁRIAS* (reiniciam à meia-noite de Brasília)\nExplorar 3 vezes: ${Math.min(3,d.explorar)}/3\nVencer 2 inimigos: ${Math.min(2,d.vencer)}/2\nConjurar 1 magia: ${Math.min(1,d.conjurar)}/1\nResgate: !missao diaria\n\n📅 *MISSÕES SEMANAIS*\nExplorar 15 vezes: ${Math.min(15,w.explorar)}/15\nVencer 10 inimigos: ${Math.min(10,w.vencer)}/10\nConjurar 5 magias: ${Math.min(5,w.conjurar)}/5\nResgate: !missao semanal`;
}
async function resgatarMissao(id,nome,tipo) {
    const r=progressoMissoes(id); const diaria=tipo==='diaria'; const p=diaria?r.diarias:r.semanais; const meta=diaria?{explorar:3,vencer:2,conjurar:1}:{explorar:15,vencer:10,conjurar:5};
    if (!diaria && tipo!=='semanal') return mostrarMissoes(id);
    const completa=Object.entries(meta).every(([k,v])=>p[k]>=v); const flag=diaria?'diariasResgatadas':'semanaisResgatadas';
    if (r[flag]) return 'Você já resgatou essa missão neste período.';
    if (!completa) return `Ainda não concluiu todas as tarefas.\n\n${mostrarMissoes(id)}`;
    r[flag]=true; const premio=diaria?250:1200; await adicionarWACoins(id,nome,premio); await salvarSistemas310();
    return `🏅 Missões ${tipo==='diaria'?'diárias':'semanais'} concluídas! Você recebeu ${formatarWACoins(premio)}.`;
}
async function processarChefe(sock,jid,id,nome,args) {
    const acao=normalizar(args[0]||'status'); let chefe=sistemasV310.chefes[jid];
    if (acao==='iniciar') {
        if (chefe && chefe.hp>0) return 'Já existe um Chefe Mundial ativo nesta conversa.';
        chefe={nome:aleatorio(['Colosso das Cinzas','Dragão do Vazio','Titã Abissal']),hp:12000,hpMax:12000,ataque:45,defesa:12,iniciadoEm:Date.now(),contribuicoes:{},ultimaAcao:0};
        sistemasV310.chefes[jid]=chefe; await salvarSistemas310();
        return `🌋 *CHEFE MUNDIAL: ${chefe.nome.toUpperCase()}*\n❤️ ${chefe.hp}/${chefe.hpMax} HP\n\nTodos podem participar com !chefemundial atacar. Use !chefemundial status para ver o progresso.`;
    }
    if (!chefe || chefe.hp<=0) return 'Não há Chefe Mundial ativo. Um administrador ou jogador pode iniciar com !chefemundial iniciar.';
    if (acao==='status') return `🌋 *${chefe.nome}*\n❤️ HP: ${chefe.hp}/${chefe.hpMax}\n⚔️ Participantes: ${Object.keys(chefe.contribuicoes).length}\n🏆 Maior dano: ${Object.entries(chefe.contribuicoes).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([u,d],i)=>`${i+1}. ${nomeExibicao(u)} — ${d}`).join('\n')||'Ainda ninguém.'}`;
    if (acao==='atacar' || acao==='conjurar') {
        const j=obterJogadorRPG(id,nome); if (j.hp<=0) return 'Seu personagem está sem vida. Use !rpg descansar.';
        let dano=Math.max(1,j.ataque+randomInt(0,12)-chefe.defesa); let extra='';
        if (acao==='conjurar') {
            const chave=normalizar(args.slice(1).join('_')).replace(/\s+/g,'_'); const magia=RPG_MAGIAS[chave];
            if (!magia || !j.magias.includes(chave)) return 'Magia inválida ou não desbloqueada. Use !rpg magias.';
            if (chave==='agua') { const cura=Math.min(25,j.hpMax-j.hp); j.hp+=cura; dano=Math.max(1,Math.floor(dano*.5)); extra=`\n💧 Recuperou ${cura} HP.`; }
            else if (chave==='plantificar') dano=Math.round(dano*1.4);
            else if (chave==='bola_de_fogo') dano=Math.round((j.ataque*2.4+18)*obterMultiplicadorMagiaRPG(j));
            else dano=Math.round(dano*1.25);
            registrarProgressoMissoes(id,'conjurar',1);
        }
        dano=Math.max(1,dano); chefe.hp=Math.max(0,chefe.hp-dano); chefe.contribuicoes[id]=(chefe.contribuicoes[id]||0)+dano;
        let resultado=`⚔️ ${nome} causou ${dano} de dano a ${chefe.nome}.${extra}\n❤️ Chefe: ${chefe.hp}/${chefe.hpMax} HP`;
        if (chefe.hp===0) {
            const ranking=Object.entries(chefe.contribuicoes).sort((a,b)=>b[1]-a[1]);
            for (const [uid, danoTotal] of ranking) { const premio=150+Math.floor(danoTotal/25); await adicionarWACoins(uid,nomeExibicao(uid),premio); const j2=obterJogadorRPG(uid,nomeExibicao(uid)); j2.moedas+=Math.floor(premio/2); await salvarRPG(); }
            resultado+=`\n\n🏆 *CHEFE DERROTADO!*\n${ranking.slice(0,5).map(([u,d],i)=>`${i+1}. ${nomeExibicao(u)} — ${d} dano`).join('\n')}\nRecompensas foram enviadas aos participantes.`;
            chefe.derrotadoEm=Date.now(); chefe.hp=0;
        }
        await Promise.all([salvarSistemas310(),salvarRPG(),salvarWACoins()]); return resultado;
    }
    return 'Use !chefemundial iniciar | status | atacar | conjurar NOME.';
}
async function processarPVP(sock,jid,id,nome,args,msg) {
    const acao=normalizar(args[0]||''); let duelo=sistemasV310.desafiosPVP[jid];
    if (acao==='aceitar') {
        if (!duelo || duelo.status!=='convite' || !mesmoUsuario(duelo.alvo,id)) return 'Você não possui um convite de duelo pendente.';
        duelo.status='ativo'; duelo.vez=duelo.desafiante; await salvarSistemas310();
        return `⚔️ *DUELO INICIADO!*\n${duelo.nomeA} vs ${duelo.nomeB}\nVez de ${duelo.nomeA}. Use !pvp atacar ou !pvp magia NOME.`;
    }
    if (acao==='recusar') { if (!duelo||duelo.status!=='convite'||!mesmoUsuario(duelo.alvo,id)) return 'Nenhum convite pendente.'; delete sistemasV310.desafiosPVP[jid]; await salvarSistemas310(); return 'Convite de duelo recusado.'; }
    if (!acao || acao==='desafiar' || acao.startsWith('@') || (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []).length>0) {
        const indiceAlvo = acao==='desafiar' ? 1 : 0;
        const alvo=mencionarAlvo(msg,args,indiceAlvo); if (!alvo||mesmoUsuario(alvo,id)) return 'Desafie alguém marcando a pessoa: !pvp @pessoa.';
        if (duelo?.status==='ativo') return 'Já existe um duelo ativo nesta conversa.';
        const a=obterJogadorRPG(id,nome); if (a.hp<=0) return 'Seu personagem precisa estar vivo.';
        const nomeB=nomeExibicao(alvo); const b=obterJogadorRPG(alvo,nomeB);
        sistemasV310.desafiosPVP[jid]={status:'convite',desafiante:id,alvo,nomeA:nome,nomeB,hpA:a.hpMax,hpB:b.hpMax,hpAmax:a.hpMax,hpBmax:b.hpMax,vez:id,criadoEm:Date.now()}; await salvarSistemas310();
        return `⚔️ ${nome} desafiou ${nomeB} para um duelo RPG!\n${nomeB}, use !pvp aceitar ou !pvp recusar.`;
    }
    if (!duelo||duelo.status!=='ativo') return 'Não existe duelo ativo. Use !pvp @pessoa para desafiar.';
    if (!mesmoUsuario(duelo.vez,id)) return 'Ainda não é sua vez.';
    const ladoA=mesmoUsuario(id,duelo.desafiante); const hpKey=ladoA?'hpB':'hpA'; const selfKey=ladoA?'hpA':'hpB';
    const j=obterJogadorRPG(id,nome); let dano=Math.max(1,j.ataque+randomInt(0,10)); let acaoTexto='';
    if (acao==='fugir') { delete sistemasV310.desafiosPVP[jid]; await salvarSistemas310(); return `${nome} encerrou o duelo.`; }
    if (acao==='magia') {
        const chave=normalizar(args.slice(1).join('_')).replace(/\s+/g,'_'); const magia=RPG_MAGIAS[chave];
        if (!magia||!j.magias.includes(chave)) return 'Magia não desbloqueada. Confira !rpg magias.';
        if (chave==='agua') { duelo[selfKey]=Math.min(ladoA?duelo.hpAmax:duelo.hpBmax,duelo[selfKey]+25); dano=Math.max(1,Math.floor(dano*.35)); acaoTexto='💧 Água restaurou vida e reduziu o impacto.'; }
        else if (chave==='plantificar') { dano=Math.round(dano*1.35); acaoTexto='🌿 As raízes prenderam o adversário.'; }
        else if (chave==='bola_de_fogo') { dano=Math.round((j.ataque*2.4+18)*obterMultiplicadorMagiaRPG(j)); acaoTexto='🔥 Bola de fogo conjurada!'; }
        else if (chave==='necromancia') { dano=Math.round(dano*1.2); acaoTexto='☠️ Seu aliado zumbi avançou!'; }
        else { dano=Math.round(dano*1.25); acaoTexto=`🔮 ${magia.nome} ativada!`; }
        registrarProgressoMissoes(id,'conjurar',1);
    } else if (acao!=='atacar') return 'Use !pvp atacar, !pvp magia NOME ou !pvp fugir.';
    duelo[hpKey]=Math.max(0,duelo[hpKey]-dano); const perdeu=duelo[hpKey]===0;
    const alvoNome=ladoA?duelo.nomeB:duelo.nomeA; let resposta=`${acaoTexto?acaoTexto+'\n':''}⚔️ ${nome} causou ${dano} de dano em ${alvoNome}.\n❤️ ${duelo.nomeA}: ${duelo.hpA}/${duelo.hpAmax}\n❤️ ${duelo.nomeB}: ${duelo.hpB}/${duelo.hpBmax}`;
    if (perdeu) { resposta+=`\n\n🏆 *${nome} venceu o duelo!*`; delete sistemasV310.desafiosPVP[jid]; }
    else duelo.vez=ladoA?duelo.alvo:duelo.desafiante;
    await salvarSistemas310(); return resposta;
}

// ==================================================
// PROCESSAR COMANDOS
// ==================================================

function numeroDoJid(jid) {
    if (!jid) return '';

    return String(jid)
        .split('@')[0]
        .split(':')[0]
        .replace(/\D/g, '');
}
async function remetenteEhAdminBot(sock, msg) {
    // A autorização é feita exclusivamente pela lista NUMEROS_ADM do index.js.
    // Mensagens próprias não recebem permissão automática.
    const jid = msg.key?.remoteJid;
    const candidatos = [
        msg.key?.participant,
        msg.key?.participantAlt,
        msg.key?.remoteJid
    ].filter(Boolean);

    // Só considera o JID da própria conta quando a mensagem foi enviada por ela.
    if (msg.key?.fromMe) candidatos.push(sock.user?.id, sock.user?.lid);

    if (jid?.endsWith('@g.us')) {
        try {
            const metadata = await sock.groupMetadata(jid);
            const participante = metadata.participants.find(p =>
                mesmoUsuario(p.id, msg.key?.participant) ||
                mesmoUsuario(p.lid, msg.key?.participantAlt)
            );
            if (participante) {
                candidatos.push(participante.id, participante.phoneNumber, participante.lid);
            }
        } catch {}
    }

    return candidatos
        .map(numeroDoJid)
        .filter(Boolean)
        .some(numero => NUMEROS_ADM.map(n => String(n).replace(/\D/g, '')).includes(numero));
}

const PERGUNTAS_ENTREVISTA = [
    '1/5 — Por que você quer participar da equipe? Responda com suas próprias palavras.',
    '2/5 — Como você agiria se dois membros começassem uma discussão no grupo?',
    '3/5 — O que faria se um amigo seu quebrasse uma regra?',
    '4/5 — Como você ajudaria alguém que está com dificuldade para usar o bot?',
    '5/5 — Existe algo que você gostaria de acrescentar? (Opcional)'
];

async function salvarHistoricoEntrevistas() {
    await salvarJSON(ARQUIVO_ENTREVISTAS, historicoEntrevistas);
}

async function notificarAdministradores(sock, mensagem) {
    const destinos = [...new Set(NUMEROS_ADM.map(n => String(n).replace(/\D/g, '')).filter(Boolean))];
    for (const numero of destinos) {
        try { await texto(sock, `${numero}@s.whatsapp.net`, mensagem); }
        catch (erro) { console.error('[ENTREVISTA] Falha ao notificar administrador:', erro.message); }
    }
}

async function iniciarEntrevista(sock, msg, nome) {
    const jidPrivado = msg.key.remoteJid;
    if (jidPrivado.endsWith('@g.us')) {
        await texto(sock, jidPrivado, 'Use !entrevista em uma conversa privada com o WABOT.');
        return;
    }

    if (!await remetenteEhAdminBot(sock, msg)) {
        await texto(sock, jidPrivado, '⛔ Somente os números cadastrados em NUMEROS_ADM no index.js podem iniciar uma entrevista.');
        return;
    }

    const numero = numeroDoJid(jidPrivado);
    const existente = [...entrevistasAtivas.values()].find(e => e.numero === numero);
    if (existente) {
        await texto(sock, jidPrivado, `Você já possui uma entrevista em andamento: ${existente.grupoJid}`);
        return;
    }

    const nomeSeguro = String(nome || 'Candidato').replace(/[\r\n\t]/g, ' ').slice(0, 35);
    try {
        const criado = await sock.groupCreate(`🎙️ Entrevista - ${nomeSeguro}`, [jidPrivado]);
        const grupoJid = criado?.id;
        if (!grupoJid) throw new Error('O WhatsApp não retornou o ID do grupo.');

        const entrevista = {
            grupoJid,
            candidatoJid: jidPrivado,
            numero,
            nome: nomeSeguro,
            respostas: [],
            perguntaAtual: 0,
            inicio: new Date().toISOString(),
            status: 'em_andamento'
        };
        entrevistasAtivas.set(grupoJid, entrevista);
        historicoEntrevistas[numero] = entrevista;
        await salvarHistoricoEntrevistas();

        let convite = '';
        try {
            const codigo = await sock.groupInviteCode(grupoJid);
            if (codigo) convite = `\n\nLink do grupo: https://chat.whatsapp.com/${codigo}`;
        } catch (erro) {
            console.error('[ENTREVISTA] Não foi possível obter o convite:', erro.message);
        }

        await texto(sock, jidPrivado,
            `✅ Sua sala de entrevista foi criada!\n` +
            `Entre no grupo para responder às perguntas.${convite}\n\n` +
            `A entrevista tem ${PERGUNTAS_ENTREVISTA.length} perguntas. Não envie dados pessoais sensíveis.`
        );
        await texto(sock, grupoJid,
            `🎙️ *ENTREVISTA INICIADA*\nCandidato: ${nomeSeguro}\n\n` +
            `Responda uma pergunta por vez.\n\n${PERGUNTAS_ENTREVISTA[0]}`
        );
        await notificarAdministradores(sock,
            `📋 Nova entrevista iniciada\nCandidato: ${nomeSeguro}\nNúmero: ${numero}\nGrupo: ${grupoJid}`
        );
    } catch (erro) {
        console.error('[ENTREVISTA] Erro ao criar grupo:', erro);
        await texto(sock, jidPrivado,
            '❌ Não consegui criar o grupo da entrevista. Verifique se o WhatsApp permite criar grupos e tente novamente.');
    }
}

async function processarRespostaEntrevista(sock, msg, textoRecebido) {
    const grupoJid = msg.key.remoteJid;
    const entrevista = entrevistasAtivas.get(grupoJid);
    if (!entrevista || entrevista.status !== 'em_andamento') return false;
    if (msg.key.fromMe) return true;

    const remetente = obterParticipante(msg);
    if (!mesmoUsuario(remetente, entrevista.candidatoJid)) return true;

    const resposta = String(textoRecebido || '').trim();
    if (!resposta) return true;
    if (resposta.length > 1500) {
        await texto(sock, grupoJid, 'Sua resposta passou de 1.500 caracteres. Envie uma versão mais curta.');
        return true;
    }

    entrevista.respostas.push({
        pergunta: PERGUNTAS_ENTREVISTA[entrevista.perguntaAtual],
        resposta,
        data: new Date().toISOString()
    });
    entrevista.perguntaAtual++;
    historicoEntrevistas[entrevista.numero] = entrevista;
    await salvarHistoricoEntrevistas();

    if (entrevista.perguntaAtual < PERGUNTAS_ENTREVISTA.length) {
        await texto(sock, grupoJid, `✅ Resposta registrada.\n\n${PERGUNTAS_ENTREVISTA[entrevista.perguntaAtual]}`);
        return true;
    }

    entrevista.status = 'aguardando_avaliacao';
    entrevista.fim = new Date().toISOString();
    historicoEntrevistas[entrevista.numero] = entrevista;
    await salvarHistoricoEntrevistas();

    const relatorio = [
        '📋 *ENTREVISTA CONCLUÍDA*',
        `Candidato: ${entrevista.nome}`,
        `Número: ${entrevista.numero}`,
        `Grupo: ${entrevista.grupoJid}`,
        '',
        ...entrevista.respostas.flatMap((item, i) => [`*${i + 1}. ${item.pergunta}*`, item.resposta, ''])
    ].join('\n');

    await texto(sock, grupoJid, '✅ Entrevista concluída! Suas respostas foram encaminhadas para avaliação da equipe.');
    await notificarAdministradores(sock,
        `${relatorio}\nPara registrar a decisão, responda com:\n!aprovar ${entrevista.numero}\n!reprovar ${entrevista.numero}`
    );
    return true;
}

function obterMencoes(msg) {
    const contexto = msg.message?.extendedTextMessage?.contextInfo
        || msg.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo
        || {};
    return Array.isArray(contexto.mentionedJid) ? contexto.mentionedJid : [];
}

function desenharVelha(jogo) {
    const casas = jogo.tabuleiro.map((valor, i) => valor || String(i + 1));
    return `╭───┬───┬───╮\n│ ${casas[0]} │ ${casas[1]} │ ${casas[2]} │\n├───┼───┼───┤\n│ ${casas[3]} │ ${casas[4]} │ ${casas[5]} │\n├───┼───┼───┤\n│ ${casas[6]} │ ${casas[7]} │ ${casas[8]} │\n╰───┴───┴───╯`;
}

function verificarVitoriaVelha(tabuleiro, simbolo) {
    const linhas = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return linhas.some(linha => linha.every(i => tabuleiro[i] === simbolo));
}

async function enviarLojaPesca(sock, jid, id, nome) {
    try {
        const carteira = obterCarteira(id, nome);
        const chaveMenu = `${jid}:${id}`;
        const itens = Object.entries(LOJA_PESCA);
        menusLojaPesca.set(chaveMenu, {
            itens: itens.map(([itemId]) => itemId),
            criadoEm: Date.now()
        });

        const grupos = [
            ['🎣 VARAS', ['vara']],
            ['🪱 ISCAS', ['isca']],
            ['🍀 AMULETOS E ANÉIS', ['amuleto', 'anel']],
            ['🌊 RELICÁRIOS E PINGENTES', ['relicario', 'pingente']],
            ['⚡ VELOCIDADE E PESO', ['acelerador', 'peso']],
            ['🧵 LINHAS E PROFUNDIDADE', ['linha']]
        ];
        const eventoAtivo = obterEventoPescaAtivo();
        const chancesAtuais = calcularChancesPesca(obterDadosPescador(id, nome), eventoAtivo?.bonusSorte || 0);
        const tempoRestante = obterTempoRestantePesca(id, obterDadosPescador(id, nome));
        const pescador = obterDadosPescador(id, nome);
        const linhas = [
            '🎣 *LOJA DE PESCA DO WABOT*',
            `💰 Seu saldo: *${formatarWACoins(carteira.saldo)}*`,
            '',
            '📊 *SEUS ATRIBUTOS ATUAIS*',
            `🍀 Sorte: ${calcularSortePesca(pescador, eventoAtivo?.bonusSorte || 0)}/25${eventoAtivo ? ` (inclui +${eventoAtivo.bonusSorte} do evento)` : ''}`,
            `⏱️ Recarga da pesca: ${Math.ceil(obterTempoCooldownPesca(pescador) / 1000)}s`,
            `⌛ Tempo restante agora: ${Math.ceil(tempoRestante / 1000)}s`,
            `⚡ Redução de recarga: ${calcularReducaoTempoPesca(pescador)}%`,
            `⚖️ Bônus de peso: +${Math.round(calcularBonusPesoPesca(pescador) * 100)}%`,
            `🧵 Linha: nível ${pescador.equipamentos.linha || 0}/5 — ${obterProfundidadeLinha(pescador)} m de profundidade`,
            `🎲 Chance de lixo: ${calcularChanceLixoPesca(pescador).toFixed(1).replace('.', ',')}%`,
            `🐟 Comum ${chancesAtuais.texto[0]} | Incomum ${chancesAtuais.texto[1]} | Raro ${chancesAtuais.texto[2]}`,
            `💎 Épico ${chancesAtuais.texto[3]} | Lendário ${chancesAtuais.texto[4]} | Divino ${chancesAtuais.texto[5]}`,
            `🎟️ Evento: ${eventoAtivo ? `${eventoAtivo.nome} (+${eventoAtivo.bonusSorte} sorte)` : 'nenhum ativo'}`,
            `🎁 Itens de evento: ${pescador.itensEvento?.length || 0} | Bônus permanente: +${pescador.bonusSorteEvento || 0} sorte`,
            '',
            '━━━━━━━━━━━━━━━━━━'
        ];

        let numero = 0;
        for (const [titulo, tipos] of grupos) {
            const selecionados = itens.filter(([, item]) => tipos.includes(item.tipo));
            if (!selecionados.length) continue;
            linhas.push('', `*${titulo}*`);
            for (const [itemId, item] of selecionados) {
                numero++;
                let bonus = '';
                if (item.sorte) bonus = ` | +${item.sorte} sorte`;
                else if (item.tipo === 'peso') bonus = ` | +${[0, 20, 40, 65][item.nivel]}% peso`;
                else if (item.tipo === 'acelerador') bonus = ` | ${[0, 20, 35, 50][item.nivel]}% mais rápido`;
                else if (item.tipo === 'linha') bonus = ` | até ${[0, 30, 75, 150, 300, 600][item.nivel]} m e espécies de maior profundidade`;
                linhas.push(`${numero}. *${item.nome}*`, `   💰 ${formatarWACoins(item.preco)}${bonus}`);
            }
        }

        linhas.push(
            '',
            '━━━━━━━━━━━━━━━━━━',
            '🛒 *COMO COMPRAR*',
            'Envie ! seguido do número para comprar.',
            'Exemplo: *!1*',
            '',
            'Digite *!cancelarloja* para cancelar.',
            '⏳ O menu expira em 5 minutos.'
        );

        await texto(sock, jid, linhas.join('\n'));
    } catch (erro) {
        console.error('[PESCA] Erro ao montar/enviar loja:', erro);
        await texto(sock, jid, '❌ Não foi possível abrir a loja de pesca. Tente novamente com !lojapesca.');
    }
}

async function enviarAvisoManutencao(sock, jid, caption) {
    try {
        const imagem = await readFile(IMAGEM_MANUTENCAO);
        await enviar(sock, jid, { image: imagem, caption });
        return;
    } catch {}
    try {
        const imagemAlternativa = await readFile(IMAGEM_OFF);
        await enviar(sock, jid, { image: imagemAlternativa, caption });
        return;
    } catch {}
    await texto(sock, jid, caption);
}

function extrairObjetoJSON(texto, marcador) {
    const posicaoMarcador = texto.indexOf(marcador);
    if (posicaoMarcador < 0) return null;
    const inicio = texto.indexOf('{', posicaoMarcador + marcador.length);
    if (inicio < 0) return null;

    let profundidade = 0;
    let emString = false;
    let escape = false;
    for (let i = inicio; i < texto.length; i++) {
        const caractere = texto[i];
        if (emString) {
            if (escape) escape = false;
            else if (caractere === '\\') escape = true;
            else if (caractere === '"') emString = false;
            continue;
        }
        if (caractere === '"') emString = true;
        else if (caractere === '{') profundidade++;
        else if (caractere === '}') {
            profundidade--;
            if (profundidade === 0) {
                try { return JSON.parse(texto.slice(inicio, i + 1)); }
                catch { return null; }
            }
        }
    }
    return null;
}

function coletarVideosYouTube(dados) {
    const encontrados = [];
    const visitados = new Set();
    function visitar(valor) {
        if (!valor || typeof valor !== 'object' || visitados.has(valor) || encontrados.length >= 8) return;
        visitados.add(valor);
        if (valor.videoRenderer?.videoId) {
            const video = valor.videoRenderer;
            const titulo = video.title?.runs?.map(item => item.text || '').join('') || video.title?.simpleText || '';
            const canal = video.ownerText?.runs?.map(item => item.text || '').join('') || video.shortBylineText?.runs?.map(item => item.text || '').join('') || 'Canal não identificado';
            const duracao = video.lengthText?.simpleText || 'Duração não informada';
            if (titulo) encontrados.push({ id: video.videoId, titulo, canal, duracao });
        }
        for (const filho of Object.values(valor)) visitar(filho);
    }
    visitar(dados);
    return encontrados;
}

async function buscarVideosSemelhantes(descricao) {
    const consulta = String(descricao || '').trim().slice(0, 180);
    if (consulta.length < 4) throw new Error('Escreva uma descrição com pelo menos 4 caracteres.');

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(consulta)}`;
    const resposta = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
        },
        signal: AbortSignal.timeout(12000)
    });
    if (!resposta.ok) throw new Error(`YouTube respondeu com HTTP ${resposta.status}.`);

    const html = await resposta.text();
    const dados = extrairObjetoJSON(html, 'var ytInitialData =')
        || extrairObjetoJSON(html, 'ytInitialData =');
    if (!dados) throw new Error('Não consegui interpretar os resultados do YouTube.');

    const videos = coletarVideosYouTube(dados);
    const unicos = [...new Map(videos.map(video => [video.id, video])).values()];
    if (!unicos.length) throw new Error('Nenhum vídeo foi encontrado para essa descrição.');
    return unicos.slice(0, 3);
}

async function enviarVideosSemelhantes(sock, jid, descricao) {
    try {
        const videos = await buscarVideosSemelhantes(descricao);
        const lista = videos.map((video, indice) =>
            `${indice + 1}. *${video.titulo}*\n   Canal: ${video.canal}\n   Duração: ${video.duracao}\n   https://www.youtube.com/watch?v=${video.id}`
        ).join('\n\n');
        await texto(sock, jid,
            `🔎 *VÍDEOS PARECIDOS COM SUA DESCRIÇÃO*\n\nPesquisa: _${descricao.trim().slice(0, 180)}_\n\n${lista}\n\n_Resultados encontrados no YouTube. Confira o conteúdo antes de compartilhar._`);
    } catch (erro) {
        console.error('[VIDEO] Erro na busca do YouTube:', erro.message);
        await texto(sock, jid,
            `❌ Não consegui buscar vídeos agora.\nMotivo: ${erro.message}\n\nTente novamente mais tarde ou use uma descrição mais específica.`);
    }
}

async function processarComando(sock, msg) {
    const jid = msg.key.remoteJid;

    if (!jid || jid === 'status@broadcast') return;

    const idMensagem = `${jid}:${msg.key.id}`;

    if (mensagensProcessadas.has(idMensagem)) return;

    mensagensProcessadas.add(idMensagem);

    if (mensagensProcessadas.size > 5000) {
        const primeira = mensagensProcessadas.values().next().value;
        mensagensProcessadas.delete(primeira);
    }

    const conteudo = extrairTexto(msg.message).trim();

    // Durante manutenção, apenas os números configurados em NUMEROS_ADM controlam o bot.
    if (conteudo.startsWith(PREFIXO)) {
        const comandoManutencao = conteudo.split(/\s+/)[0].toLowerCase();
        if (comandoManutencao === '!manutencao') {
            if (!await remetenteEhAdminBot(sock, msg)) {
                await texto(sock, jid, '⛔ Apenas os administradores configurados no código podem ativar ou encerrar a manutenção.');
                return;
            }
            const acao = conteudo.split(/\s+/)[1]?.toLowerCase();
            manutencaoAtiva = acao === 'on' ? true : acao === 'off' ? false : !manutencaoAtiva;
            carteirasWACoins.__manutencao_ativa = manutencaoAtiva;
            await salvarWACoins();
            if (manutencaoAtiva) {
                await enviarAvisoManutencao(sock, jid, '🛠️ WABOT EM MANUTENÇÃO. Voltaremos em breve.');
            } else {
                await texto(sock, jid, '✅ Manutenção encerrada. WABOT disponível novamente.');
            }
            return;
        }
    }

    if (manutencaoAtiva && conteudo.startsWith(PREFIXO) && !await remetenteEhAdminBot(sock, msg)) {
        await enviarAvisoManutencao(sock, jid, '🛠️ O WABOT está em manutenção. Tente novamente mais tarde.');
        return;
    }

    // Com o bot desligado, mensagens comuns não avançam entrevistas nem executam ações.
    if (!botAtivo && !conteudo.startsWith(PREFIXO)) return;

    // Respostas livres dentro de uma sala de entrevista são processadas antes dos comandos.
    if (jid.endsWith('@g.us') && entrevistasAtivas.has(jid) && !conteudo.startsWith(PREFIXO)) {
        await processarRespostaEntrevista(sock, msg, conteudo);
        return;
    }

    const participante = obterParticipante(msg);
    const nome = obterNome(msg);
    if (jid.endsWith('@g.us')) await atualizarNomesDoGrupo(sock, jid);
    const nomeResolvido = nomeExibicao(participante, nome);
    const chaveMenuLoja = `${jid}:${participante}`;
    const menuLoja = menusLojaPesca.get(chaveMenuLoja);

    // Seleção individual da loja: aceita !1 (preferido) e também o número puro por compatibilidade.
    if (menuLoja && (/^!\d+$/.test(conteudo) || /^\d+$/.test(conteudo))) {
        if (Date.now() - menuLoja.criadoEm > 5 * 60 * 1000) {
            menusLojaPesca.delete(chaveMenuLoja);
            await texto(sock, jid, '⌛ O menu da loja expirou. Envie !lojapesca para abrir novamente.');
            return;
        }
        const escolha = Number(conteudo.replace(/^!/, ''));
        if (escolha < 1 || escolha > menuLoja.itens.length) {
            await texto(sock, jid, `❌ Escolha inválida. Envie !1 até !${menuLoja.itens.length}, ou !cancelarloja.`);
            return;
        }
        const itemId = menuLoja.itens[escolha - 1];
        menusLojaPesca.delete(chaveMenuLoja);
        await comprarItemPesca(sock, jid, participante, nome, itemId);
        return;
    }

    if (!conteudo.startsWith(PREFIXO)) return;

    const partes = conteudo.split(/\s+/);
    const comando = partes[0].toLowerCase();
    const args = partes.slice(1);

    if (comando === '!boton' || comando === '!botoff') {
        if (!await remetenteEhAdminBot(sock, msg)) {
            await texto(sock, jid, '⛔ Você não está autorizado a controlar o WABOT.');
            return;
        }

        if (comando === '!boton') {
            botAtivo = true;
            try {
                const imagem = await readFile(IMAGEM_ON);
                await enviar(sock, jid, { image: imagem, caption: '✅ WABOT ATIVADO!' });
            } catch {
                await texto(sock, jid, '✅ WABOT ativado. (Não encontrei midia/ON.png.)');
            }
        } else {
            try {
                const imagem = await readFile(IMAGEM_OFF);
                await enviar(sock, jid, { image: imagem, caption: '🛑 WABOT DESATIVADO.' });
            } catch {
                await texto(sock, jid, '🛑 WABOT desativado. (Não encontrei midia/OFF.png.)');
            }
            botAtivo = false;
        }

        return;
    }

    if (!botAtivo) return;

    let resposta = '';
    let registrar = true;

    console.log(`[WABOT] ${comando} - ${nomeResolvido}`);

    switch (comando) {

        case '!upd': {
            resposta = `🆕 *ATUALIZAÇÕES RECENTES DO WABOT*\n\n*V3.1.7 — Correções e melhorias*\n• Correção na exibição de nomes: prioriza nomes do WhatsApp e do grupo em vez de identificadores numéricos.\n• Melhor compatibilidade de fontes em imagens, com fallback para caracteres acentuados e emojis.\n• Ajustes de renderização e qualidade de imagens PNG.\n• Novo comando !upd para consultar as novidades.\n\n*V3.1.6 — Desempenho e estabilidade*\n• Filas de mensagens organizadas por conversa.\n• Processamento simultâneo limitado entre conversas.\n• Proteção contra mensagens duplicadas e filas excessivas.\n• Gravações JSON serializadas para reduzir conflitos.\n• Cache temporário de imagens limitado.\n• Reconexão progressiva e logs de diagnóstico.\n\n*V3.1.5 — Novos sistemas*\n• Árvore de habilidades do RPG.\n• Agendamento de resets de RPG e pesca.\n• Roleta com imagem de resultado.\n• Sistema de renascimento da pesca com bônus permanentes.`;
            break;
        }

        case '!helprpg': {
            resposta = `🧭 *GUIA DO RPG WABOT*\n\nO RPG é independente da pesca e dos WACoins. Possui níveis, XP, vida, combate, equipamentos e magias.\n\n!rpg iniciar — criar personagem\n!rpg — ver status\n!rpg explorar — explorar\n!rpg atacar — atacar inimigo\n!rpg fugir — fugir\n!rpg curar — usar poção\n!rpg descansar — recuperar vida\n!rpg loja — loja\n!rpg comprar ID — comprar item\n!rpg inventario — inventário\n!rpg equipar ID — equipar item\n!rpg missao — missão\n!rpg arvore — imagem da árvore de evolução\n!rpg evoluir ataque/defesa/vida/magia — gastar ponto\n!rpg magias — ver magias e chances\n!rpg usar_liberador — roleta de poderes\n!rpg conjurar NOME — conjurar poder desbloqueado\n!chefemundial iniciar/status/atacar/conjurar NOME — chefe compartilhado\n!pvp @pessoa — duelo com magias\n!missoes — tarefas diárias e semanais\n\nO Liberador de poder é comprado na loja do RPG. Cada uso sorteia uma magia ainda não desbloqueada; poderes mais raros têm chances menores.\n⭐ Nível: +15 HP máximo, +2 ataque, +1 defesa e 1 ponto de evolução.\n🌳 Evolução: !rpg arvore | !rpg evoluir ataque/defesa/vida/magia.\n🪙 Moedas RPG são separadas dos WACoins.`;
            break;
        }

        case '!resetagendar': {
            resposta = await processarAgendamentoReset(sock,jid,msg,args);
            break;
        }
        case '!rodadasorte': {
            await executarRoletaGratuita(sock,jid,participante,nome);
            registrar = false;
            break;
        }
        case '!renascerpesca':
        case '!renascimento': {
            await renascerPesca(sock,jid,participante,nome);
            registrar = false;
            break;
        }
        case '!mercado': {
            resposta = await processarMercado(participante, nome, args);
            break;
        }
        case '!guilda': {
            resposta = await processarGuilda(participante, nome, args);
            break;
        }
        case '!guildas': {
            resposta = listarGuildas();
            break;
        }
        case '!diario':
        case '!recompensadiaria': {
            resposta = await processarDiario(participante, nome);
            break;
        }
        case '!sequencia': {
            const r=sistemasV310.recompensasDiarias[participante] || {};
            resposta=`🔥 *SUA SEQUÊNCIA*\nDias consecutivos: ${r.sequencia||0}\nÚltimo resgate: ${r.ultimoDiario||'Nunca'}\n\nUse !diario para resgatar sua recompensa.`;
            break;
        }
        case '!missoes': {
            resposta = mostrarMissoes(participante);
            break;
        }
        case '!missao': {
            resposta = await resgatarMissao(participante,nome,normalizar(args[0]||''));
            break;
        }
        case '!chefemundial':
        case '!chefe': {
            resposta = await processarChefe(sock,jid,participante,nome,args);
            break;
        }
        case '!pvp': {
            resposta = await processarPVP(sock,jid,participante,nome,args,msg);
            break;
        }

        case '!rpg': {
            if (normalizar(args[0]||'') === 'arvore' || normalizar(args[0]||'') === 'arvore_evolucao') {
                try {
                    const jogador = obterJogadorRPG(participante,nome);
                    const imagemArvore = await gerarImagemArvoreRPG(jogador);
                    await enviar(sock,jid,{image:imagemArvore,caption:`🌳 *ÁRVORE DE EVOLUÇÃO*\nPontos disponíveis: ${jogador.pontosEvolucao||0}\n\n!rpg evoluir ataque | defesa | vida | magia`});
                    registrar = false;
                } catch (e) { console.error('[ARVORE RPG]',e); resposta = 'Não consegui gerar a árvore de evolução.'; }
            } else {
                resposta = await processarRPG(participante, nome, args);
            }
            break;
        }

        case '!entrevista': {
            await iniciarEntrevista(sock, msg, nome);
            registrar = false;
            break;
        }

        case '!entrevistas': {
            if (!await remetenteEhAdminBot(sock, msg)) {
                resposta = '⛔ Você não está autorizado a consultar entrevistas.';
                break;
            }
            const ativas = [...entrevistasAtivas.values()];
            const pendentes = Object.values(historicoEntrevistas).filter(e => e.status === 'aguardando_avaliacao');
            resposta = `🎙️ *ENTREVISTAS*\nEm andamento: ${ativas.length}\nAguardando avaliação: ${pendentes.length}`;
            if (pendentes.length) resposta += '\n\n' + pendentes.map(e => `• ${e.nome} — ${e.numero}`).join('\n');
            break;
        }

        case '!aprovar':
        case '!reprovar': {
            if (!await remetenteEhAdminBot(sock, msg)) {
                resposta = '⛔ Você não está autorizado a avaliar entrevistas.';
                break;
            }
            const numeroAlvo = String(args[0] || '').replace(/\D/g, '');
            const entrevista = historicoEntrevistas[numeroAlvo];
            if (!entrevista || entrevista.status !== 'aguardando_avaliacao') {
                resposta = 'Não encontrei uma entrevista pendente para esse número.';
                break;
            }
            entrevista.status = comando === '!aprovar' ? 'aprovado' : 'reprovado';
            entrevista.avaliadoEm = new Date().toISOString();
            entrevista.avaliadoPor = numeroDoJid(msg.key.participant || msg.key.remoteJid || sock.user?.id);
            await salvarHistoricoEntrevistas();
            const aprovado = comando === '!aprovar';
            await texto(sock, entrevista.candidatoJid,
                aprovado ? '🎉 Sua entrevista foi avaliada: você foi aprovado(a)!' : 'Sua entrevista foi avaliada. Desta vez, você não foi aprovado(a). Obrigado por participar.');
            resposta = aprovado ? `✅ Entrevista de ${entrevista.nome} aprovada.` : `❎ Entrevista de ${entrevista.nome} reprovada.`;
            break;
        }

        case '!cancelarentrevista': {
            if (!await remetenteEhAdminBot(sock, msg)) {
                resposta = '⛔ Você não está autorizado a cancelar entrevistas.';
                break;
            }
            const alvo = String(args[0] || '').replace(/\D/g, '');
            const entrevista = [...entrevistasAtivas.values()].find(e => e.grupoJid === jid || (alvo && e.numero === alvo));
            if (!entrevista) {
                resposta = 'Não encontrei entrevista ativa. Use !cancelarentrevista [número] ou execute dentro do grupo da entrevista.';
                break;
            }
            entrevista.status = 'cancelada';
            historicoEntrevistas[entrevista.numero] = entrevista;
            entrevistasAtivas.delete(entrevista.grupoJid);
            await salvarHistoricoEntrevistas();
            await texto(sock, entrevista.grupoJid, 'A entrevista foi cancelada pela administração.');
            resposta = `Entrevista de ${entrevista.nome} cancelada.`;
            break;
        }

        // ==========================================
        // AJUDA
        // ==========================================

        case '!help':
        case '!comandos': {
            try {
                await enviar(sock, jid, {
                    image: { url: IMAGEM_HELP },
                    caption:
`🤖 *WABOT V${VERSAO}*

📌 *GERAIS*
!ping
!upd (novidades das duas últimas atualizações)
!info
!doar @pessoa quantidade
!mercado (trocas entre jogadores)
!guilda criar NOME / !guilda / !guildas
!guilda convidar @pessoa / !guilda entrar ID
!diario / !sequencia
!missoes / !missao diaria|semanal
!chefemundial iniciar/status/atacar
!pvp @pessoa / !pvp aceitar / !pvp atacar / !pvp magia NOME
!eventopesca (admin)
!sobre
!id
!grupo
!uptime
!divulgar
!perfil
!conquistas
!bio texto
!statusperfil texto
!lojaperfil
!comprarperfil ID
!equiparperfil ID
!inventarioperfil
!figurinha
!entrevista (somente números autorizados)
!entrevistas
!aprovar [número]
!reprovar [número]
!cancelarentrevista [número]

🎮 *DIVERSÃO*
!moeda
!dado
!escolher
!ship
!8ball
!sorte
!duelo
!roleta
!par
!frase
!sorteio
!video descrição (busca vídeos semelhantes no YouTube)
!helpRPG (guia do RPG separado)
!rpg (sistema de aventura)
!chefemundial (chefe compartilhado)
!pvp @pessoa (duelo RPG)

🎣 *PESCA*
!pescar
!peixes
!rankingpesca
!venderpeixes (vende todos os peixes disponíveis)
!venderpeixes raridade (ex.: raro, epico, lendario)
!lojapesca (loja; compre com !1, !2, etc.)
!eventopesca iniciar taco 30 3 (admin; também mare, estrelas, abismo)
!evento (ver tempo restante do evento)
!comprarpesca ID (ou escolha um número na loja)
Itens extras: acelerador_1/2/3, peso_1/2/3, anel_1/2/3, relicario_1/2/3, pingente_1/2/3 e linha_1/2/3/4/5

🧩 *JOGOS*
!anagrama (prêmio: 250 WACoins)
!desanagrama
!forca (prêmio: 500 WACoins)
!letra
!chutarpalavra
!velha @pessoa
!aceitarvelha
!jogarvelha 1-9
!desistirvelha

🧠 *QUIZ*
!quiz (+10 WACoins)
!quizhard (+25 WACoins)
!resposta
!quizparar
!rankingquiz
!wacoins / !saldo
!banco
!depositar quantidade
!resgatar quantidade / tudo

💬 *INTERAÇÃO*
!reagir
!tirarreacao
!votar
!resultado

🛠️ *ADMINISTRAÇÃO*
!limpar
!limparmax
!botON (somente admins configurados)
!botOFF (somente admins configurados)
!manutencao on/off (somente admins configurados)

Desenvolvido por Ghostine.`
                });
            } catch (erro) {
                console.error('Erro ao enviar help:', erro);
                resposta = '❌ Não consegui enviar a imagem do help. Confira midia/help.png.';
            }

            break;
        }

        // ==========================================
        // GERAIS
        // ==========================================

        case '!wacoins':
        case '!saldo': {
            const carteira = obterCarteira(participante, nome);
            resposta = `💰 *CARTEIRA WACOINS*\n\nDisponível: ${formatarWACoins(carteira.saldo)}\nNo banco: ${formatarWACoins(carteira.banco)}\n\nUse !depositar valor, !resgatar valor ou !banco.`;
            break;
        }

        case '!banco': {
            const carteira = obterCarteira(participante, nome);
            const periodos = atualizarJurosBanco(carteira, participante);
            if (periodos) await salvarWACoins();
            const proximo = INTERVALO_JUROS_MS - (Date.now() - carteira.ultimaAtualizacaoBanco);
            const minutos = Math.max(0, Math.ceil(proximo / 60000));
            resposta = `🏦 *BANCO WABOT*\n\nSaldo no banco: ${formatarWACoins(carteira.banco)}\nRendimento: ${(obterTaxaBanco(participante) * 100).toFixed(2).replace('.', ',')}% a cada 60 minutos\nPróximo rendimento em: ${minutos} minuto(s)\n\nDepositar: !depositar quantidade\nResgatar: !resgatar quantidade\nUse !resgatar tudo para retirar todo o saldo.`;
            break;
        }

        case '!depositar': {
            const valorInformado = Number(String(args[0] || '').replace(',', '.'));
            const valor = Math.round(valorInformado * 100) / 100;
            if (!Number.isFinite(valor) || valor <= 0) { resposta = 'Informe uma quantidade válida. Exemplo: !depositar 1000'; break; }
            const carteira = obterCarteira(participante, nome);
            atualizarJurosBanco(carteira, participante);
            if (valor > carteira.saldo) { resposta = `Saldo insuficiente. Sua carteira tem ${formatarWACoins(carteira.saldo)}.`; break; }
            const bancoEstavaVazio = carteira.banco <= 0;
            carteira.saldo = Math.round((carteira.saldo - valor) * 100) / 100;
            carteira.banco = Math.round((carteira.banco + valor) * 100) / 100;
            if (bancoEstavaVazio) carteira.ultimaAtualizacaoBanco = Date.now();
            await salvarWACoins();
            resposta = `🏦 Depósito realizado!\n\nDepositado: ${formatarWACoins(valor)}\nSaldo no banco: ${formatarWACoins(carteira.banco)}\nSaldo disponível: ${formatarWACoins(carteira.saldo)}`;
            break;
        }

        case '!resgatar': {
            const carteira = obterCarteira(participante, nome);
            atualizarJurosBanco(carteira, participante);
            const valorInformado = normalizar(args[0] || '') === 'tudo' ? carteira.banco : Number(String(args[0] || '').replace(',', '.'));
            const valor = Math.round(valorInformado * 100) / 100;
            if (!Number.isFinite(valor) || valor <= 0) { resposta = 'Informe a quantidade ou use !resgatar tudo.'; break; }
            if (valor > carteira.banco) { resposta = `O banco possui apenas ${formatarWACoins(carteira.banco)}.`; break; }
            carteira.banco = Math.round((carteira.banco - valor) * 100) / 100;
            carteira.saldo = Math.round((carteira.saldo + valor) * 100) / 100;
            await salvarWACoins();
            resposta = `💸 Resgate realizado!\n\nResgatado: ${formatarWACoins(valor)}\nSaldo disponível: ${formatarWACoins(carteira.saldo)}\nSaldo restante no banco: ${formatarWACoins(carteira.banco)}`;
            break;
        }


        case '!doar': {
            const mencoes = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const alvoDigitado = args[0] || '';
            const alvo = mencoes[0] || (alvoDigitado.replace(/\D/g, '')
                ? `${alvoDigitado.replace(/\D/g, '')}@s.whatsapp.net`
                : '');
            const valor = Math.round(Number(String(args[1] || '').replace(',', '.')) * 100) / 100;
            if (!alvo || !Number.isFinite(valor) || valor <= 0) {
                resposta = '❌ Use: !doar @pessoa quantidade\nExemplo: !doar @5511999999999 250';
                break;
            }
            if (mesmoUsuario(alvo, participante)) {
                resposta = '❌ Você não pode doar WACoins para si mesmo.';
                break;
            }
            const origem = obterCarteira(participante, nome);
            if (origem.saldo < valor) {
                resposta = `❌ Saldo insuficiente. Você possui ${formatarWACoins(origem.saldo)}.`;
                break;
            }
            const nomeAlvo = nomeExibicao(alvo);
            const destino = obterCarteira(alvo, nomeAlvo);
            origem.saldo = Math.round((origem.saldo - valor) * 100) / 100;
            destino.saldo = Math.round((destino.saldo + valor) * 100) / 100;
            await salvarWACoins();
            resposta = `🎁 *DOAÇÃO REALIZADA*\n\nVocê enviou ${formatarWACoins(valor)} para *${nomeExibicao(alvo)}*.\nSeu saldo: ${formatarWACoins(origem.saldo)}\nSaldo do destinatário: ${formatarWACoins(destino.saldo)}`;
            await enviar(sock, jid, { text: resposta, mentions: [alvo] });
            resposta = '';
            break;
        }


        case '!evento':
        case '!tempoevento':
        case '!eventotempo': {
            const evento = obterEventoPescaAtivo();
            if (!evento) {
                resposta = '🎣 Não há nenhum evento de pesca ativo no momento.';
                break;
            }
            resposta = `${evento.emoji} *EVENTO DE PESCA ATIVO*\n\n${evento.nome}\n⏳ Tempo restante: *${formatarTempoEvento(evento.terminaEm - Date.now())}*\n🍀 Bônus de sorte: +${evento.bonusSorte}\n🐟 Peixes exclusivos disponíveis.`;
            break;
        }

        case '!eventopesca': {
            if (!await remetenteEhAdminBot(sock, msg)) {
                resposta = '⛔ Somente o número autorizado no código pode controlar eventos de pesca.';
                break;
            }
            const acao = normalizar(args[0] || '');
            if (acao === 'parar' || acao === 'off' || acao === 'encerrar') {
                const eventoAnterior = obterEventoPescaAtivo();
                delete carteirasWACoins.__evento_pesca;
                await salvarWACoins();
                resposta = eventoAnterior
                    ? `🛑 Evento ${eventoAnterior.nome} encerrado.`
                    : 'Não existe evento de pesca ativo.';
                break;
            }
            if (acao !== 'iniciar' && acao !== 'on') {
                resposta = '🎣 *CONTROLE DE EVENTOS DE PESCA*\n\nIniciar: !eventopesca iniciar mare 30 3\nTipos: taco, mare, estrelas, abismo\nFormato: tipo, duração em minutos, bônus de sorte (1 a 10).\nEncerrar: !eventopesca parar';
                break;
            }
            const evento = criarEventoPesca(args[1] || 'mare', args[2] || 30, args[3] || 3);
            carteirasWACoins.__evento_pesca = evento;
            await salvarWACoins();
            resposta = `${evento.emoji} *EVENTO DE PESCA ATIVADO!*\n\n${evento.nome}\n⏱️ Duração: ${Math.round((evento.terminaEm - Date.now()) / 60000)} minutos\n🍀 Bônus de sorte: +${evento.bonusSorte}\n🐟 Peixes exclusivos disponíveis!\n🎁 Durante o evento, capturas podem conceder bônus permanente de sorte.`;
            break;
        }

        case '!ping':
            resposta = `🏓 PONG!\n\nOlá, ${nome}! Estou funcionando.`;
            break;

        case '!info':
            resposta =
`🤖 INFORMAÇÕES DO WABOT

Versão: ${VERSAO}
Status: Online
Prefixo: ${PREFIXO}
Tempo ligado: ${tempoLigado()}
Quizzes ativos: ${quizzesAtivos.size}
Pescadores registrados: ${Object.keys(dadosPesca).length}`;
            break;

        case '!sobre':
            resposta =
`🤖 WABOT

Bot de diversão e interação para grupos do WhatsApp.

Jogos, quizzes, votações, reações, pesca e ferramentas de grupo.

Versão ${VERSAO}.`;
            break;

        case '!id':
            resposta = `🆔 ID DO CHAT\n\n${jid}`;
            break;

        case '!grupo': {
            if (!jid.endsWith('@g.us')) {
                resposta = '❌ Este comando funciona somente em grupos.';
                break;
            }

            const grupo = await sock.groupMetadata(jid);

            resposta =
`📋 INFORMAÇÕES DO GRUPO

Nome: ${grupo.subject}
Participantes: ${grupo.participants.length}`;
            break;
        }

        case '!uptime':
            resposta = `⏱️ WABOT está ligado há:\n${tempoLigado()}`;
            break;

        // ==========================================
        // DIVULGAÇÃO
        // ==========================================

        case '!divulgar': {
            const campos = args.join(' ').split('|').map(campo => campo.trim());
            if (!args.length || normalizar(args[0]) === 'ajuda') {
                resposta =
`📣 *CENTRAL DE DIVULGAÇÃO DO WABOT*

Crie um cartaz para compartilhar grupos, canais, projetos, lojas, eventos e comunidades.

*Formato:*
!divulgar tipo | título | descrição | link | chamada

*Tipos aceitos:*
grupo, canal, projeto, loja, evento, comunidade ou outro.

*Exemplo:*
!divulgar grupo | Galera dos Games | Grupo para conversar sobre jogos, novidades e encontrar pessoas para jogar. | https://chat.whatsapp.com/SEULINK | ENTRE AGORA

O WABOT gera um cartaz e publica somente nesta conversa. Para divulgar em um canal, encaminhe a imagem para ele. O comando não dispara mensagens em massa nem envia mensagens privadas sem autorização.`;
                break;
            }

            const tipo = normalizar(campos[0] || 'outro');
            const titulo = campos[1] || '';
            const descricao = campos[2] || '';
            const link = campos[3] || '';
            const chamada = campos[4] || 'ACESSE E PARTICIPE';
            const tiposValidos = ['grupo', 'canal', 'projeto', 'loja', 'evento', 'comunidade', 'outro'];

            if (!tiposValidos.includes(tipo)) {
                resposta = '❌ Tipo inválido. Use grupo, canal, projeto, loja, evento, comunidade ou outro.';
                break;
            }
            if (titulo.length < 3 || titulo.length > 60) {
                resposta = '❌ O título precisa ter entre 3 e 60 caracteres.';
                break;
            }
            if (descricao.length < 10 || descricao.length > 260) {
                resposta = '❌ A descrição precisa ter entre 10 e 260 caracteres.';
                break;
            }
            if (link && (!/^https?:\/\//i.test(link) || link.length > 300)) {
                resposta = '❌ O link deve começar com http:// ou https:// e ter até 300 caracteres.';
                break;
            }
            if (chamada.length > 36) {
                resposta = '❌ A chamada final pode ter no máximo 36 caracteres.';
                break;
            }

            try {
                const imagemDivulgacao = await gerarImagemDivulgacao(tipo, titulo, descricao, chamada);
                const legenda = `📣 *${titulo}*\n\n${descricao}${link ? `\n\n🔗 ${link}` : ''}\n\n_${({grupo:'Grupo',canal:'Canal',projeto:'Projeto',loja:'Loja / Serviço',evento:'Evento',comunidade:'Comunidade',outro:'Divulgação'})[tipo]} divulgado com WABOT._`;
                await enviar(sock, jid, { image: imagemDivulgacao, caption: legenda });
                registrar = false;
            } catch (erro) {
                console.error('[DIVULGAR] Erro ao gerar cartaz:', erro);
                resposta = '❌ Não consegui criar o cartaz. Verifique os dados e tente novamente.';
            }
            break;
        }

        // ==========================================
        // PERFIL VISUAL
        // ==========================================

        case '!lojaperfil': {
            resposta = montarLojaPerfil(participante, nome);
            break;
        }

        case '!comprarperfil': {
            resposta = await comprarItemPerfil(
                participante,
                nome,
                String(args[0] || '').toLowerCase()
            );
            break;
        }

        case '!equiparperfil': {
            resposta = await equiparItemPerfil(
                participante,
                String(args[0] || '').toLowerCase()
            );
            break;
        }

        case '!inventarioperfil': {
            resposta = montarInventarioPerfil(participante);
            break;
        }

        case '!bio': {
            const perfil = obterPersonalizacao(participante);
            const novaBio = args.join(' ').trim();
            if (!novaBio) {
                resposta = `📝 *SUA BIO*\n\n${perfil.bio || 'Você ainda não escreveu uma bio.'}\n\nPara alterar: !bio sua descrição\nLimite: 92 caracteres.\nPara apagar: !bio limpar`;
                break;
            }
            if (normalizar(novaBio) === 'limpar') {
                perfil.bio = '';
            } else {
                if (novaBio.length > 92) {
                    resposta = '❌ Sua bio pode ter no máximo 92 caracteres.';
                    break;
                }
                perfil.bio = novaBio;
            }
            await salvarPersonalizacao(participante);
            resposta = '✅ Bio atualizada! Use !perfil para ver como ficou.';
            break;
        }

        case '!statusperfil': {
            const perfil = obterPersonalizacao(participante);
            const novoStatus = args.join(' ').trim();
            if (!novoStatus) {
                resposta = `📍 *STATUS DO PERFIL*\n\n${perfil.status || 'Disponível para jogar'}\n\nAlterar: !statusperfil seu status\nLimite: 30 caracteres.\nRestaurar: !statusperfil limpar`;
                break;
            }
            if (normalizar(novoStatus) === 'limpar') {
                perfil.status = '';
            } else {
                if (novoStatus.length > 30) {
                    resposta = '❌ O status pode ter no máximo 30 caracteres.';
                    break;
                }
                perfil.status = novoStatus;
            }
            await salvarPersonalizacao(participante);
            resposta = '✅ Status atualizado! Use !perfil para visualizar.';
            break;
        }

        case '!conquistas': {
            try {
                const imagemConquistas = await gerarImagemConquistas(participante, nome);
                const total = obterConquistasDetalhadas(participante);
                const liberadas = total.filter(item => item.desbloqueada).length;
                await enviar(sock, jid, {
                    image: imagemConquistas,
                    caption: `🏆 *CONQUISTAS DE ${nome.toUpperCase()}*\n\n${liberadas} de ${total.length} conquistas desbloqueadas.\nContinue jogando para liberar as próximas!`
                });
                registrar = false;
            } catch (erro) {
                console.error('[CONQUISTAS] Erro ao gerar imagem:', erro);
                resposta = '❌ Não consegui gerar sua imagem de conquistas.';
            }
            break;
        }

        case '!perfil': {
            try {
                const imagemPerfil = await gerarImagemPerfil(
                    sock,
                    participante,
                    nome
                );

                await enviar(sock, jid, {
                    image: imagemPerfil,
                    caption:
`👤 *PERFIL DE ${nome.toUpperCase()}*

🪙 Saldo: ${formatarWACoins(obterCarteira(participante, nome).saldo)}
⭐ Nível: ${calcularNivelPerfil(obterPontosQuiz(participante)).nivel}
🏆 Conquistas: ${obterConquistasPerfil(participante).length}

📝 Bio: !bio sua descrição
📍 Status: !statusperfil seu status
🛍️ Personalização: !lojaperfil
🎒 Inventário: !inventarioperfil

🏦 Banco WABOT: !banco`
                });
            } catch (erro) {
                console.error('[WABOT] Erro ao gerar perfil:', erro);

                resposta =
'❌ Não consegui gerar seu perfil. Tente novamente.';
            }

            break;
        }

        // ==========================================
        // PESCA
        // ==========================================

        case '!pescar': {
            await pescar(sock, jid, participante, nome);
            break;
        }

        case '!peixes': {
            resposta = montarColecaoPesca(participante, nome);
            break;
        }

        case '!venderpeixes': {
            await venderPeixes(sock, jid, participante, nome, args.join(' '));
            break;
        }

        case '!video': {
            const descricao = args.join(' ').trim();
            if (!descricao) {
                resposta = '❌ Informe uma descrição. Exemplo: !video gameplay de terror em primeira pessoa com monstros';
                break;
            }
            await enviarVideosSemelhantes(sock, jid, descricao);
            break;
        }

        case '!rankingpesca': {
            try {
                const imagem = await gerarImagemRankingPesca();

                await enviar(sock, jid, {
                    image: imagem,
                    caption: '🎣 *RANKING DOS PESCADORES*\n\nUse !pescar para tentar subir no ranking!'
                });
            } catch (erro) {
                console.error('[PESCA] Erro ao gerar ranking:', erro);

                resposta =
                    `🎣 *RANKING DOS PESCADORES*\n\n${montarRankingPesca()}`;
            }

            break;
        }

        case '!cancelarloja': {
            menusLojaPesca.delete(`${jid}:${participante}`);
            resposta = '✅ Menu da loja cancelado.';
            break;
        }

        case '!lojapesca': {
            await enviarLojaPesca(sock, jid, participante, nome);
            break;
        }

        case '!comprarpesca': {
            if (!args[0]) {
                resposta = '❌ Informe o ID do item. Use !lojapesca para consultar.';
                break;
            }

            await comprarItemPesca(
                sock,
                jid,
                participante,
                nome,
                args[0].toLowerCase()
            );

            break;
        }

        case '!figurinha': {
            const foto = FOTOS_RECENTES.get(jid);

            if (!foto) {
                resposta = '❌ Não encontrei uma foto recente neste chat. Envie uma foto e depois use !figurinha.';
                break;
            }

            try {
                const sticker = await sharp(foto)
                    .rotate()
                    .resize(512, 512, {
                        fit: 'contain',
                        background: {
                            r: 0,
                            g: 0,
                            b: 0,
                            alpha: 0
                        }
                    })
                    .webp({ quality: 88 })
                    .toBuffer();

                await enviar(sock, jid, { sticker });
            } catch (erro) {
                console.error('[FIGURINHA] Erro:', erro);
                resposta = '❌ Não consegui converter a foto em figurinha.';
            }

            break;
        }

        // ==========================================
        // JOGOS RÁPIDOS
        // ==========================================

        case '!moeda': {
            const resultado = randomInt(0, 2) === 0 ? 'CARA' : 'COROA';

            resposta =
`🪙 MOEDA LANÇADA!

Jogador: ${nome}
Resultado: ${resultado}`;
            break;
        }

        case '!dado': {
            const lados = args.length ? Number(args[0]) : 6;

            if (!Number.isInteger(lados) || lados < 2 || lados > 1000) {
                resposta = '❌ Use !dado 20. Limite: D1000.';
                break;
            }
            resposta = `🎲 DADO D${lados}\n\n${nome} tirou: ${randomInt(1, lados + 1)}`;
            break;
        }

        case '!escolher': {
            const opcoes = args.join(' ')
                .split(',')
                .map(x => x.trim())
                .filter(Boolean);

            if (opcoes.length < 2 || opcoes.length > 30) {
                resposta = '❌ Informe de 2 a 30 opções separadas por vírgula.';
                break;
            }

            resposta = `🎯 ESCOLHA ALEATÓRIA\n\n${aleatorio(opcoes)}`;
            break;
        }
        case '!ship': {
            const nomes = args.join(' ')
                .split(',')
                .map(x => x.trim())
                .filter(Boolean);

            if (nomes.length !== 2) {
                resposta = '❌ Exemplo: !ship Dipper, Mabel';
                break;
            }

            const [nome1, nome2] = nomes;
            const porcentagem = randomInt(0, 101);

            resposta =
`💘 WABOT SHIPPER

${nome1} + ${nome2}
Nome do casal: ${criarShip(nome1, nome2)}
Compatibilidade fictícia: ${porcentagem}%

${porcentagem >= 80 ? '💘 CASAL LENDÁRIO!' :
  porcentagem >= 60 ? '💕 Uma combinação interessante!' :
  porcentagem >= 40 ? '👀 Talvez exista uma possibilidade.' :
  '😅 Melhor continuar como amizade!'}

*É apenas uma brincadeira.*`;
            break;
        }

        case '!8ball': {
            if (!args.length) {
                resposta = '❌ Exemplo: !8ball Vou ganhar?';
                break;
            }

            resposta =
`🔮 BOLA MÍSTICA

Pergunta: ${args.join(' ')}

Resposta: ${aleatorio([
    'Com certeza!',
    'As chances são boas.',
    'Sim, sem dúvidas!',
    'Talvez...',
    'Não conte com isso.',
    'O futuro está incerto.',
    'Definitivamente não!',
    'Pergunte novamente mais tarde.',
    'Os sinais apontam que sim.'
])}`;
            break;
        }

        case '!sorte':
            resposta =
`🍀 RELATÓRIO DE SORTE

Jogador: ${nome}
Número da sorte: ${randomInt(1, 101)}
Cor da sorte: ${aleatorio(['Azul', 'Vermelho', 'Verde', 'Roxo', 'Amarelo'])}
Sorte fictícia: ${randomInt(0, 101)}%`;
            break;

        case '!duelo': {
            const nomes = args.join(' ')
                .split(',')
                .map(x => x.trim())
                .filter(Boolean);

            if (nomes.length !== 2) {
                resposta = '❌ Exemplo: !duelo Ghostine, Amigo';
                break;
            }

            const p1 = randomInt(0, 101);
            const p2 = randomInt(0, 101);

            resposta =
`⚔️ DUELO DO WABOT

${nomes[0]}: ${p1} pontos
${nomes[1]}: ${p2} pontos

${p1 > p2 ? `🏆 ${nomes[0]} venceu!` :
  p2 > p1 ? `🏆 ${nomes[1]} venceu!` : '🤝 EMPATE!'}

*Resultado aleatório de brincadeira.*`;
            break;
        }

        case '!roleta': {
            if (!jid.endsWith('@g.us')) {
                resposta = '❌ Use este comando em um grupo.';
                break;
            }

            const grupo = await sock.groupMetadata(jid);

            const membros = grupo.participants.filter(p => {
                const id = p.id || p.jid || p.phoneNumber;

                return id &&
                    !mesmoUsuario(id, sock.user?.id) &&
                    !mesmoUsuario(id, sock.user?.lid);
            });

            if (!membros.length) {
                resposta = 'Não encontrei participantes para sortear.';
                break;
            }

            const escolhido = aleatorio(membros);
            const id = escolhido.id || escolhido.jid || escolhido.phoneNumber;

            await enviar(sock, jid, {
                text: `🎡 ROLETA DO WABOT\n\nO sorteado foi: @${id.split('@')[0]}!`,
                mentions: [id]
            });

            break;
        }

        // ==========================================
        // QUIZ NORMAL
        // ==========================================

        case '!quiz': {
            if (quizzesAtivos.has(jid)) {
                resposta = '⚠️ Já existe um quiz ativo! Use !resposta SUA_RESPOSTA.';
                break;
            }

            const pergunta = iniciarQuiz(jid, 'NORMAL');

            resposta =
`🧠 QUIZ NORMAL

${pergunta.pergunta}

🏆 Recompensa: +10 WACoins

Todos podem participar!
Use: !resposta SUA_RESPOSTA`;
            break;
        }

        // ==========================================
        // QUIZ HARD
        // ==========================================

        case '!quizhard': {
            if (quizzesAtivos.has(jid)) {
                resposta = '⚠️ Já existe um quiz ativo! Use !resposta SUA_RESPOSTA.';
                break;
            }

            const pergunta = iniciarQuiz(jid, 'HARD');

            resposta =
`🔥 QUIZ HARD

${pergunta.pergunta}

🏆 Recompensa: +25 WACoins!

Dificuldade: EXTREMA
Modo atual: TEXTO

📸 Versão com perguntas por imagem: EM BREVE!

Use: !resposta SUA_RESPOSTA`;
            break;
        }

        // ==========================================
        // RESPOSTA DO QUIZ
        // ==========================================

        case '!resposta': {
            const quiz = quizzesAtivos.get(jid);

            if (!quiz) {
                resposta = '❌ Não existe quiz ativo. Use !quiz ou !quizhard.';
                break;
            }

            if (!args.length) {
                resposta = '❌ Escreva sua resposta.';
                break;
            }

            if (quiz.participantes.has(participante)) {
                resposta = '⏳ Você já tentou responder nesta rodada.';
                break;
            }

            quiz.participantes.add(participante);
            quiz.tentativas++;

            if (normalizar(args.join(' ')) === normalizar(quiz.pergunta.resposta)) {
                await registrarPonto(
                    participante,
                    nome,
                    quiz.pontos,
                    quiz.recompensaWACoins
                );

                quizzesAtivos.delete(jid);

                resposta =
`🎉 RESPOSTA CORRETA!

🏆 Vencedor: ${nome}
Resposta: ${quiz.pergunta.resposta}

🔥 Dificuldade: ${quiz.dificuldade}
💰 +${quiz.recompensaWACoins} WACoins!

Use !quiz ou !quizhard para outra rodada.`;
            } else {
                resposta =
`❌ Resposta incorreta, ${nome}!

Você já usou sua tentativa.
As outras pessoas ainda podem responder!

Tentativas: ${quiz.tentativas}`;
            }

            break;
        }

        // ==========================================
        // PARAR QUIZ
        // ==========================================

        case '!quizparar': {
            if (!await usuarioEhAdmin(sock, jid, msg)) {
                resposta = '❌ Apenas administradores podem encerrar o quiz.';
                break;
            }

            if (!quizzesAtivos.has(jid)) {
                resposta = 'Não existe quiz ativo.';
                break;
            }

            quizzesAtivos.delete(jid);
            resposta = '🛑 Quiz encerrado por um administrador.';
            break;
        }

        // ==========================================
        // RANKING VISUAL
        // ==========================================

        case '!rankingquiz': {
            try {
                const imagem = await gerarImagemRanking();

                await enviar(sock, jid, {
                    image: imagem,
                    caption:
`🏆 *RANKING DE WACOINS*

🥇 Os maiores saldos da economia WABOT!

🧠 Quiz normal: +10 WACoins
🔥 Quiz hard: +25 WACoins

Continue jogando para conquistar o primeiro lugar!`
                });
            } catch (erro) {
                console.error('[WABOT] Erro no ranking:', erro);

                resposta =
'❌ Não consegui gerar o ranking. Confira se a biblioteca Sharp está instalada e se midia/ranking.png existe.';
            }

            break;
        }

        // ==========================================
        // REAÇÕES
        // ==========================================

        case '!reagir': {
            const chave = obterChaveCitada(msg, sock);
            const emoji = args.join(' ').trim();

            if (!chave) {
                resposta = '❌ Responda à mensagem desejada e envie !reagir ❤️';
                break;
            }

            if (!emoji || emoji.length > 12) {
                resposta = '❌ Informe um emoji. Exemplo: !reagir 🔥';
                break;
            }

            await sock.sendMessage(jid, {
                react: { text: emoji, key: chave }
            });

            resposta = '✅ Reação enviada!';
            break;
        }

        case '!tirarreacao': {
            const chave = obterChaveCitada(msg, sock);

            if (!chave) {
                resposta = '❌ Responda à mensagem cuja reação deseja remover.';
                break;
            }

            await sock.sendMessage(jid, {
                react: { text: '', key: chave }
            });

            resposta = '🧽 Reação removida!';
            break;
        }

        // ==========================================
        // ENQUETES
        // ==========================================

        case '!votar': {
            const partesVotacao = args.join(' ')
                .split('|')
                .map(x => x.trim())
                .filter(Boolean);
            if (partesVotacao.length < 3) {
                resposta = '❌ Exemplo:\n!votar Qual jogo é melhor? | Roblox | Minecraft';
                break;
            }

            const pergunta = partesVotacao[0];
            const opcoes = partesVotacao.slice(1);

            if (opcoes.length > 12) {
                resposta = '❌ O limite é de 12 opções.';
                break;
            }

            if (new Set(opcoes.map(normalizar)).size !== opcoes.length) {
                resposta = '❌ Existem opções repetidas.';
                break;
            }

            const criada = await enviar(sock, jid, {
                poll: {
                    name: pergunta,
                    values: opcoes,
                    selectableCount: 1
                }
            });

            if (criada?.key?.id) {
                enquetes.set(jid, {
                    key: criada.key,
                    message: criada,
                    pollUpdates: []
                });
            }

            break;
        }

        case '!resultado': {
            const enquete = enquetes.get(jid);

            if (!enquete) {
                resposta = '❌ Não encontrei uma enquete criada pelo WABOT nesta sessão.';
                break;
            }

            resposta =
`📊 RESULTADO DA VOTAÇÃO

${montarResultadoEnquete(sock, enquete)}`;
            break;
        }

        // ==========================================
        // ANAGRAMA
        // ==========================================

        case '!anagrama': {
            if (anagramasAtivos.has(jid)) {
                resposta = '⚠️ Já existe um anagrama ativo. Use !desanagrama SUA_RESPOSTA.';
                break;
            }

            const palavra = aleatorio(palavrasAnagrama);
            const embaralhada = embaralharPalavra(palavra);

            anagramasAtivos.set(jid, {
                palavra,
                embaralhada
            });

            resposta =
`🔤 DESAFIO DE ANAGRAMA

Descubra a palavra:
*${embaralhada.toUpperCase()}*

Use: !desanagrama palavra\nPrêmio: 250 WACoins`;
            break;
        }

        case '!desanagrama': {
            const jogo = anagramasAtivos.get(jid);

            if (!jogo) {
                resposta = '❌ Não existe anagrama ativo. Use !anagrama.';
                break;
            }

            if (!args.length) {
                resposta = '❌ Use !desanagrama palavra.';
                break;
            }

            if (normalizar(args.join(' ')) === normalizar(jogo.palavra)) {
                anagramasAtivos.delete(jid);
                await adicionarWACoins(participante, nome, 250);
                resposta = `🎉 ANAGRAMA RESOLVIDO!\n\n🏆 Vencedor: ${nome}\nPalavra: ${jogo.palavra.toUpperCase()}\n💰 Prêmio: 250 WACoins`;
            } else {
                resposta = `❌ Não é essa, ${nome}! Tente novamente.`;
            }
            break;
        }

        // ==========================================
        // FORCA
        // ==========================================

        case '!forca': {
            if (forcasAtivas.has(jid)) {
                resposta = '⚠️ Já existe uma partida. Use !letra ou !chutarpalavra.';
                break;
            }

            const palavra = aleatorio(palavrasForca);

            const jogo = {
                palavra,
                letras: [],
                erros: 0,
                jogadores: new Set()
            };

            forcasAtivas.set(jid, jogo);

            resposta =
`🎯 JOGO DA FORCA

${mostrarForca(jogo)}

Use !letra A para tentar uma letra.
Use !chutarpalavra palavra
Limite: 6 erros.`;
            break;
        }

        case '!letra': {
            const jogo = forcasAtivas.get(jid);

            if (!jogo) {
                resposta = '❌ Não existe jogo da forca ativo. Use !forca.';
                break;
            }

            const letra = normalizar(args[0] || '');

            if (!/^[a-z]$/.test(letra)) {
                resposta = '❌ Informe apenas uma letra. Exemplo: !letra A';
                break;
            }

            if (jogo.letras.includes(letra)) {
                resposta = '⚠️ Essa letra já foi tentada.';
                break;
            }

            jogo.letras.push(letra);
            jogo.jogadores.add(nome);

            if (!jogo.palavra.includes(letra)) {
                jogo.erros++;
            }

            const venceu = [...jogo.palavra]
                .every(l => jogo.letras.includes(l));

            const perdeu = jogo.erros >= 6;

            if (venceu || perdeu) {
                forcasAtivas.delete(jid);
                if (venceu) await adicionarWACoins(participante, nome, 500);

                resposta =
`${venceu ? '🎉 VOCÊS VENCERAM!' : 'FIM DE JOGO!'}

${mostrarForca(jogo)}

Palavra: ${jogo.palavra.toUpperCase()}
Erros: ${jogo.erros}/6
Jogadores: ${[...jogo.jogadores].join(', ')}${venceu ? '\n💰 Prêmio: 500 WACoins' : ''}`;
            } else {
                resposta =
`🎯 JOGO DA FORCA

${mostrarForca(jogo)}

Letra: ${letra.toUpperCase()}
Erros: ${jogo.erros}/6`;
            }

            break;
        }

        case '!chutarpalavra': {
            const jogo = forcasAtivas.get(jid);

            if (!jogo) {
                resposta = '❌ Não existe jogo da forca ativo. Use !forca.';
                break;
            }

            if (!args.length) {
                resposta = '❌ Use !chutarpalavra palavra.';
                break;
            }

            jogo.jogadores.add(nome);

            if (normalizar(args.join(' ')) === normalizar(jogo.palavra)) {
                forcasAtivas.delete(jid);
                await adicionarWACoins(participante, nome, 500);

                resposta =
`🎉 ${nome} descobriu a palavra!

Palavra: ${jogo.palavra.toUpperCase()}
💰 Prêmio: 500 WACoins`;
            } else {
                jogo.erros++;

                if (jogo.erros >= 6) {
                    forcasAtivas.delete(jid);
                    resposta = `Fim de jogo! A palavra era ${jogo.palavra.toUpperCase()}.`;
                } else {
                    resposta = `❌ Palavra incorreta!\n\n${mostrarForca(jogo)}`;
                }
            }

            break;
        }

        // ==========================================
        // PAR OU ÍMPAR
        // ==========================================

        case '!velha': {
            if (!jid.endsWith('@g.us')) { resposta = '❌ O jogo da velha funciona apenas em grupos.'; break; }
            if (jogosDaVelha.has(jid)) { resposta = '⚠️ Já existe uma partida neste grupo. Termine-a antes de iniciar outra.'; break; }
            const adversario = obterMencoes(msg).find(id => !mesmoUsuario(id, participante));
            if (!adversario) { resposta = 'Marque um participante para desafiar. Exemplo: !velha @pessoa'; break; }
            const jogo = { desafiante: participante, adversario, nomeDesafiante: nome, nomeAdversario: nomeExibicao(adversario), tabuleiro: Array(9).fill(''), turno: null, status: 'convite' };
            jogosDaVelha.set(jid, jogo);
            resposta = `❎ *DESAFIO DE JOGO DA VELHA*\n\n${nome} desafiou *${nomeExibicao(adversario)}*!\n\nO desafiado deve aceitar com !aceitarvelha.\nPara recusar, use !recusarvelha.`;
            await enviar(sock, jid, { text: resposta, mentions: [adversario] });
            resposta = '';
            break;
        }

        case '!aceitarvelha': {
            const jogo = jogosDaVelha.get(jid);
            if (!jogo || jogo.status !== 'convite') { resposta = 'Não existe desafio pendente neste grupo.'; break; }
            if (!mesmoUsuario(participante, jogo.adversario)) { resposta = 'Somente a pessoa desafiada pode aceitar.'; break; }
            jogo.status = 'jogando';
            jogo.turno = jogo.desafiante;
            resposta = `🎮 *PARTIDA INICIADA!*\n\n❌ ${jogo.nomeDesafiante}\n⭕ ${jogo.nomeAdversario}\n\n${desenharVelha(jogo)}\n\nVez de ${jogo.nomeDesafiante} (❌).\nUse !jogarvelha 1-9 para marcar uma casa.`;
            break;
        }

        case '!recusarvelha': {
            const jogo = jogosDaVelha.get(jid);
            if (!jogo || jogo.status !== 'convite') { resposta = 'Não existe desafio pendente.'; break; }
            if (!mesmoUsuario(participante, jogo.adversario)) { resposta = 'Somente a pessoa desafiada pode recusar.'; break; }
            jogosDaVelha.delete(jid);
            resposta = 'Desafio recusado. A partida não foi iniciada.';
            break;
        }

        case '!jogarvelha': {
            const jogo = jogosDaVelha.get(jid);
            if (!jogo || jogo.status !== 'jogando') { resposta = 'Não existe partida em andamento. Inicie com !velha @pessoa.'; break; }
            if (!mesmoUsuario(participante, jogo.turno)) { resposta = '⏳ Ainda não é sua vez.'; break; }
            const casa = Number(args[0]);
            if (!Number.isInteger(casa) || casa < 1 || casa > 9) { resposta = 'Escolha uma casa de 1 a 9. Exemplo: !jogarvelha 5'; break; }
            if (jogo.tabuleiro[casa - 1]) { resposta = 'Essa casa já está ocupada. Escolha outra.'; break; }
            const simbolo = mesmoUsuario(participante, jogo.desafiante) ? '❌' : '⭕';
            jogo.tabuleiro[casa - 1] = simbolo;
            const venceu = verificarVitoriaVelha(jogo.tabuleiro, simbolo);
            const empate = !venceu && jogo.tabuleiro.every(Boolean);
            if (venceu || empate) {
                jogosDaVelha.delete(jid);
                resposta = `${venceu ? `🏆 *${nome} VENCEU!*` : '🤝 *EMPATE!*'}\n\n${desenharVelha(jogo)}\n\nPartida encerrada.`;
            } else {
                jogo.turno = mesmoUsuario(participante, jogo.desafiante) ? jogo.adversario : jogo.desafiante;
                const nomeTurno = mesmoUsuario(jogo.turno, jogo.desafiante) ? jogo.nomeDesafiante : jogo.nomeAdversario;
                resposta = `🎮 *JOGO DA VELHA*\n\n${desenharVelha(jogo)}\n\nVez de ${nomeTurno} (${mesmoUsuario(jogo.turno, jogo.desafiante) ? '❌' : '⭕'}).\nUse !jogarvelha 1-9.`;
            }
            break;
        }

        case '!desistirvelha': {
            const jogo = jogosDaVelha.get(jid);
            if (!jogo) { resposta = 'Não existe partida ativa neste grupo.'; break; }
            if (![jogo.desafiante, jogo.adversario].some(id => mesmoUsuario(id, participante))) { resposta = 'Somente os jogadores podem desistir da partida.'; break; }
            const vencedor = mesmoUsuario(participante, jogo.desafiante) ? jogo.nomeAdversario : jogo.nomeDesafiante;
            jogosDaVelha.delete(jid);
            resposta = `🏳️ Partida encerrada por desistência.\n🏆 ${vencedor} venceu!`;
            break;
        }

        case '!par': {
            const escolha = normalizar(args[0] || '');

            if (!['par', 'impar'].includes(escolha)) {
                resposta = '❌ Escolha par ou impar. Exemplo: !par par';
                break;
            }

            const numero = randomInt(1, 21);
            const resultado = numero % 2 === 0 ? 'par' : 'impar';

            resposta =
`🎲 PAR OU ÍMPAR

Sua escolha: ${escolha.toUpperCase()}
Número: ${numero}
Resultado: ${resultado.toUpperCase()}

${escolha === resultado ? '🏆 Você acertou!' : '😅 Não foi dessa vez!'}`;
            break;
        }

        // ==========================================
        // FRASE
        // ==========================================

        case '!frase':
            resposta = `💬 FRASE DO WABOT\n\n"${aleatorio(frases)}"`;
            break;

        // ==========================================
        // SORTEIO
        // ==========================================

        case '!sorteio': {
            if (!jid.endsWith('@g.us')) {
                resposta = '❌ Este comando funciona somente em grupos.';
                break;
            }

            const grupo = await sock.groupMetadata(jid);

            const quantidade = args[0] === undefined
                ? 1
                : Number(args[0]);

            if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 10) {
                resposta = '❌ Use !sorteio [quantidade], de 1 a 10.';
                break;
            }

            const membros = grupo.participants.filter(p => {
                const id = p.id || p.jid || p.phoneNumber;

                return id &&
                    !mesmoUsuario(id, sock.user?.id) &&
                    !mesmoUsuario(id, sock.user?.lid);
            });

            if (membros.length < quantidade) {
                resposta = '❌ Não existem participantes suficientes.';
                break;
            }

            const lista = [...membros];

            for (let i = lista.length - 1; i > 0; i--) {
                const j = randomInt(0, i + 1);
                [lista[i], lista[j]] = [lista[j], lista[i]];
            }

            const vencedores = lista.slice(0, quantidade);

            const mencoes = vencedores
                .map(p => p.id || p.jid || p.phoneNumber)
                .filter(Boolean);

            await enviar(sock, jid, {
                text:
`🎉 SORTEIO DO WABOT

${vencedores.map((p, i) => {
    const id = p.id || p.jid || p.phoneNumber;
    return `${i + 1}. ${nomeExibicao(id)}`;
}).join('\n')}

Parabéns!`,
                mentions: mencoes
            });

            break;
        }

        // ==========================================
        // LIMPEZA
        // ==========================================

        case '!limpar':
        case '!limparmax': {
            if (!await usuarioEhAdmin(sock, jid, msg)) {
                resposta = '❌ Apenas administradores podem usar este comando.';
                break;
            }

            const quantidade = comando === '!limparmax'
                ? Infinity
                : 10;

            const resultado = await limparMensagens(
                sock,
                jid,
                quantidade
            );

            registrar = false;

            resposta =
`🧹 LIMPEZA CONCLUÍDA

Mensagens apagadas: ${resultado.apagadas}
Falhas: ${resultado.falhas}`;
            break;
        }

        // ==========================================
        // COMANDO DESCONHECIDO
        // ==========================================

        default:
            resposta =
`❓ COMANDO NÃO ENCONTRADO

Comando: ${comando}

Use !help para consultar os comandos.`;
            break;
    }

    if (resposta) {
        await texto(sock, jid, resposta, registrar);
    }
}

// ==================================================
// FILAS DE MENSAGENS E DIAGNÓSTICO
// ==================================================

function registrarMensagemNaFila(sock, msg) {
    const jid = msg?.key?.remoteJid;
    if (!jid || !msg.message) return;

    let fila = filasMensagens.get(jid);
    if (!fila) {
        fila = { itens: [], executando: false };
        filasMensagens.set(jid, fila);
    }

    if (fila.itens.length >= MAX_FILA_POR_CONVERSA || mensagensPendentes >= MAX_MENSAGENS_PENDENTES) {
        console.warn(`[FILA] Limite atingido; mensagem ignorada. Conversa=${jid} pendentes=${mensagensPendentes}`);
        return;
    }

    fila.itens.push({ msg, recebidaEm: Date.now() });
    mensagensPendentes++;
    executarProximaMensagem();
}

function executarProximaMensagem() {
    if (processamentosAtivos >= MAX_PROCESSAMENTOS_SIMULTANEOS) return;

    for (const [jid, fila] of filasMensagens) {
        if (processamentosAtivos >= MAX_PROCESSAMENTOS_SIMULTANEOS) break;
        if (fila.executando || fila.itens.length === 0) continue;

        const item = fila.itens.shift();
        mensagensPendentes = Math.max(0, mensagensPendentes - 1);
        fila.executando = true;
        processamentosAtivos++;

        (async () => {
            const inicioProcessamento = Date.now();
            try {
                await processarMensagemRecebida(sockAtual, item.msg);
            } catch (erro) {
                console.error(`[FILA] Falha ao processar mensagem da conversa ${jid}:`, erro?.stack || erro);
            } finally {
                const duracao = Date.now() - inicioProcessamento;
                if (duracao >= 3000) {
                    console.warn(`[DESEMPENHO] Mensagem demorou ${duracao}ms. Conversa=${jid}`);
                }
                fila.executando = false;
                processamentosAtivos = Math.max(0, processamentosAtivos - 1);
                if (fila.itens.length === 0 && !fila.executando) filasMensagens.delete(jid);
                executarProximaMensagem();
            }
        })();
    }
}

let sockAtual = null;

async function processarMensagemRecebida(sock, msg) {
    if (!msg?.message) return;

    // Download de mídia ocorre dentro da fila daquela conversa, sem bloquear as demais.
    if (!msg.key?.fromMe) {
        const imagem = msg.message.imageMessage ||
            msg.message.ephemeralMessage?.message?.imageMessage ||
            msg.message.viewOnceMessage?.message?.imageMessage ||
            msg.message.viewOnceMessageV2?.message?.imageMessage;

        if (imagem) {
            try {
                const buffer = await downloadMediaMessage(
                    msg,
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
                if (Buffer.isBuffer(buffer) && buffer.length <= LIMITE_FOTO_STICKER) {
                    FOTOS_RECENTES.set(msg.key.remoteJid, buffer);
                    // Evita crescimento indefinido do cache temporário de imagens.
                    while (FOTOS_RECENTES.size > 30) {
                        FOTOS_RECENTES.delete(FOTOS_RECENTES.keys().next().value);
                    }
                }
            } catch (erro) {
                console.error('[FIGURINHA] Não consegui guardar a foto:', erro.message);
            }
        }
    }

    await processarComando(sock, msg);
}

function logSaudeBot() {
    const agora = Date.now();
    if (agora - ultimoLogSaude < 60000) return;
    ultimoLogSaude = agora;
    const memoria = process.memoryUsage();
    console.log(`[SAÚDE] RSS=${Math.round(memoria.rss / 1024 / 1024)}MB heap=${Math.round(memoria.heapUsed / 1024 / 1024)}MB ativos=${processamentosAtivos} pendentes=${mensagensPendentes}`);
}

// ==================================================
// CONEXÃO COM WHATSAPP
// ==================================================

async function iniciarBot() {
    if (iniciando) return;

    iniciando = true;

    try {
        const { state, saveCreds } =
            await useMultiFileAuthState(SESSAO);

        const sock = makeWASocket({
            auth: state,
            markOnlineOnConnect: false,
            syncFullHistory: false
        });
        sockAtual = sock;

        iniciarAgendadorResets(sock);

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', ({
            connection,
            lastDisconnect,
            qr
        }) => {
            if (qr) {
                console.log('\nESCANEIE O QR CODE:\n');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'connecting') {
                console.log('Conectando ao WhatsApp...');
            }

            if (connection === 'open') {
                inicio = Date.now();
                iniciando = false;
                reconectando = false;
                tentativasReconexao = 0;
                if (timerReconexao) { clearTimeout(timerReconexao); timerReconexao = null; }

                console.log('\n================================');
                console.log(` WABOT V${VERSAO} CONECTADO!`);
                console.log('================================\n');
            }

            if (connection === 'close') {
                iniciando = false;

                const motivo =
                    lastDisconnect?.error?.output?.statusCode;

                console.log('Conexão encerrada:', motivo);

                if (motivo === DisconnectReason.loggedOut) {
                    console.log('Sessão encerrada. Será necessário parear novamente.');
                    return;
                }

                if (!reconectando && !timerReconexao) {
                    reconectando = true;
                    tentativasReconexao++;
                    const espera = Math.min(3000 * (2 ** Math.min(tentativasReconexao - 1, 4)), 45000);
                    console.warn(`[CONEXÃO] Nova tentativa em ${Math.round(espera / 1000)}s (tentativa ${tentativasReconexao}).`);
                    timerReconexao = setTimeout(() => {
                        timerReconexao = null;
                        iniciarBot().catch(erro => {
                            console.error('Erro ao reconectar:', erro?.stack || erro);
                            reconectando = false;
                            if (!timerReconexao) {
                                reconectando = true;
                                tentativasReconexao++;
                                const proximaEspera = Math.min(3000 * (2 ** Math.min(tentativasReconexao - 1, 4)), 45000);
                                timerReconexao = setTimeout(() => {
                                    timerReconexao = null;
                                    reconectando = false;
                                    iniciarBot().catch(e => console.error('Falha na nova tentativa:', e?.stack || e));
                                }, proximaEspera);
                            }
                        });
                    }, espera);
                }
            }
        });

        // ==========================================
        // RECEBER MENSAGENS
        // ==========================================

        sock.ev.on('messages.upsert', ({ messages }) => {
            try {
                for (const msg of messages || []) {
                    if (msg?.message) registrarMensagemNaFila(sock, msg);
                }
                logSaudeBot();
            } catch (erro) {
                console.error('[RECEBIMENTO] Erro ao colocar mensagens na fila:', erro?.stack || erro);
            }
        });

        // ==========================================
        // ATUALIZAÇÕES DAS ENQUETES
        // ==========================================

        sock.ev.on('messages.update', async atualizacoes => {
            for (const item of atualizacoes) {
                try {
                    const { key, update } = item;

                    if (!key?.id || !update?.pollUpdates) continue;

                    const jid = key.remoteJid;
                    const enquete = enquetes.get(jid);

                    if (!enquete || enquete.key.id !== key.id) {
                        continue;
                    }

                    enquete.pollUpdates.push(...update.pollUpdates);

                    if (enquete.pollUpdates.length > 1000) {
                        enquete.pollUpdates =
                            enquete.pollUpdates.slice(-1000);
                    }
                } catch (erro) {
                    console.error('Erro ao atualizar enquete:', erro);
                }
            }
        });

    } catch (erro) {
        iniciando = false;
        reconectando = false;
        throw erro;
    }
}

// ==================================================
// INICIALIZAÇÃO
// ==================================================

await carregarDados();

iniciarBot().catch(erro => {
    console.error('Falha ao iniciar o WABOT:', erro);
});
})().catch(erro => {
    console.error('[WABOT 3.1.6] ERRO FATAL NA INICIALIZAÇÃO:');
    console.error(erro?.stack || erro);
    process.exitCode = 1;
});

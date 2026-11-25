// WABOT V3.3.0 — Otimização de desempenho e filas.
(async () => {
    console.log('[WABOT 3.2.5] Arquivo index.js carregado. Preparando dependências...');

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
const VERSAO = '3.3.0';

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
const aliasesUsuarios = new Map();
const cacheNomesGrupos = new Map();
const TTL_NOMES_GRUPO = 5 * 60 * 1000;

const quizzesAtivos = new Map();
const anagramasAtivos = new Map();
const forcasAtivas = new Map();
const enquetes = new Map();
const entrevistasAtivas = new Map();
const jogosDaVelha = new Map();
const menusLojaPesca = new Map(); // menu numérico individual por usuário e conversa
const partidasPoker = new Map(); // uma partida solo por jogador/conversa
const dificuldadePoker = new Map();

const cooldownPesca = new Map();
const pescariasEmAndamento = new Set();

const pontuacaoQuiz = {};

let mensagensComando = {};
let personalizacaoPerfil = {};
let dadosPesca = {};
let historicoEntrevistas = {};
let carteirasWACoins = {};
let dadosRPG = {};
let sistemasV310 = { mercado: [], guildas: {}, membrosGuilda: {}, tripulacoes: {}, membrosTripulacao: {}, chefes: {}, desafiosPVP: {}, recompensasDiarias: {} };
let manutencaoAtiva = false;
let timerResetAgendado = null;
const gravacoesEmAndamento = new Map();
const filasMensagens = new Map();
let timerSalvarMensagens = null;
let mensagensPrecisamSalvar = false;
let salvandoMensagens = false;
let promessaSalvarMensagens = null;
const INTERVALO_DEBOUNCE_MENSAGENS = 1200;
const MAX_CONVERSAS_HISTORICO = 300;
const MAX_MENSAGENS_HISTORICO_POR_CONVERSA = 250;
const MAX_PROCESSAMENTOS_SIMULTANEOS = 3;
const MAX_FILA_POR_CONVERSA = 40;
const MAX_MENSAGENS_PENDENTES = 250;
let processamentosAtivos = 0;
let mensagensPendentes = 0;
let ultimoLogSaude = 0;

// Diagnóstico em memória: histórico limitado para não crescer indefinidamente.
const historicoErrosBot = [];
const LIMITE_HISTORICO_ERROS = 100;
let sequenciaErroBot = 0;

// Catálogo de códigos internos de diagnóstico. São categorias de referência,
// não códigos HTTP e não indicam que o erro já ocorreu.
const CATALOGO_ERROS_WABOT = {
    200: { titulo: 'ERRO NÃO CLASSIFICADO', descricao: 'Ocorreu uma falha que não correspondeu a uma categoria específica.', causa: 'Exceção inesperada ou mensagem de erro sem padrão reconhecido.', acao: 'Consulte !erros e envie o registro completo para análise.' },
    202: { titulo: 'ERRO DE PROCESSAMENTO', descricao: 'O bot falhou ao processar uma mensagem ou executar uma rotina.', causa: 'Dados inesperados, estado inválido ou falha em uma função.', acao: 'Repita uma vez. Se persistir, consulte !erros.' },
    203: { titulo: 'ERRO DE ARQUIVO / JSON', descricao: 'Falha ao ler, interpretar ou salvar dados locais.', causa: 'JSON inválido, arquivo ausente ou permissão de escrita.', acao: 'Verifique os arquivos de dados e as permissões no host. Faça backup antes de qualquer reparo.' },
    204: { titulo: 'ERRO DE COMANDO', descricao: 'Um comando recebeu argumentos inválidos ou falhou durante sua execução.', causa: 'Sintaxe incorreta, parâmetro ausente ou falha na rotina do comando.', acao: 'Confira !help ou !helprpg e tente novamente com a sintaxe indicada.' },
    205: { titulo: 'ERRO DE CONEXÃO', descricao: 'A conexão com o WhatsApp foi interrompida ou não pôde ser estabelecida.', causa: 'Instabilidade de rede, sessão desconectada ou indisponibilidade do serviço.', acao: 'Confira o console do Enzonic e o estado da sessão do Baileys.' },
    206: { titulo: 'ERRO DE IMAGEM', descricao: 'Falha ao gerar, carregar ou enviar uma imagem.', causa: 'Arquivo de mídia ausente, SVG inválido ou erro no processamento do Sharp.', acao: 'Confira a pasta midia e o registro em !erros.' },
    207: { titulo: 'ERRO DE RPG / JOGO', descricao: 'Falha em uma operação de RPG, masmorra, pesca ou minijogo.', causa: 'Dados de jogador inconsistentes ou estado inesperado da partida.', acao: 'Consulte o perfil e envie o código da mensagem junto com o registro do erro.' }
};

function classificarCodigoErro(erro) {
    const texto = String(erro || '').toLowerCase();
    if (/json|enoent|eacces|permission|readfile|writefile|arquivo|syntaxerror.*json/.test(texto)) return 203;
    if (/sharp|svg|png|jpeg|image|imagem|midia|mídia/.test(texto)) return 206;
    if (/connection|socket|timed out|timeout|disconnect|stream erro|whatsapp|baileys/.test(texto)) return 205;
    if (/masmorra|rpg|pesca|wacoin|jogador|inventario|inventário/.test(texto)) return 207;
    if (/comando|argument|parâmetro|parametro|syntax/.test(texto)) return 204;
    if (/message|process|handler|upsert|undefined|null/.test(texto)) return 202;
    return 200;
}

const historicoCodigosMensagem = new Map();
const LIMITE_CODIGOS_MENSAGEM = 5000;
const consoleErrorOriginal = console.error.bind(console);
console.error = (...args) => {
    const erro = args.map(item => item instanceof Error ? (item.stack || item.message) : String(item)).join(' ');
    historicoErrosBot.push({ numero: ++sequenciaErroBot, codigo: classificarCodigoErro(erro), horario: new Date().toISOString(), erro: erro.slice(0, 3000) });
    if (historicoErrosBot.length > LIMITE_HISTORICO_ERROS) historicoErrosBot.shift();
    consoleErrorOriginal(...args);
};


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

// ==================================================
// IDENTIDADE VISUAL SAZONAL E CÓDIGOS DE MENSAGEM
// ==================================================

function estaNaEdicaoNatalina() {
    const hoje = dataLocalISO();
    return hoje >= '2026-11-23' && hoje <= '2027-01-02';
}

function gerarCodigoMensagem() {
    const data = dataLocalISO().replace(/-/g, '');
    const sequencia = randomInt(0, 36 ** 5).toString(36).toUpperCase().padStart(5, '0');
    return `WB-${data}-${sequencia}`;
}

function aplicarMolduraNatalSVG(svgOriginal) {
    const svg = String(svgOriginal ?? '');
    if (!estaNaEdicaoNatalina() || !svg.includes('</svg>')) return svg;
    const largura = Math.max(100, Number(svg.match(/<svg[^>]*\bwidth=["'](\d+)/i)?.[1]) || 1024);
    const altura = Math.max(100, Number(svg.match(/<svg[^>]*\bheight=["'](\d+)/i)?.[1]) || 1024);
    const moldura = `<g opacity=".96" pointer-events="none"><rect x="5" y="5" width="${largura-10}" height="${altura-10}" rx="24" fill="none" stroke="#B72F45" stroke-width="9"/><rect x="15" y="15" width="${largura-30}" height="${altura-30}" rx="19" fill="none" stroke="#1E7A50" stroke-width="4"/><circle cx="38" cy="38" r="9" fill="#F4D477"/><circle cx="${largura-38}" cy="38" r="9" fill="#F4D477"/><circle cx="38" cy="${altura-38}" r="9" fill="#F4D477"/><circle cx="${largura-38}" cy="${altura-38}" r="9" fill="#F4D477"/><path d="M${largura/2-20} 18 l8 13 12 2 -10 9 2 13 -12 -6 -12 6 2 -13 -10 -9 12 -2z" fill="#F4D477"/></g>`;
    return svg.replace('</svg>', `${moldura}</svg>`);
}

function decorarSaidaWABOT(conteudo, jid = '') {
    if (!conteudo || typeof conteudo !== 'object') return conteudo;
    const saida = { ...conteudo };
    const codigo = gerarCodigoMensagem();
    const textoOriginal = [saida.text, saida.caption].filter(v => typeof v === 'string').join('\n');
    historicoCodigosMensagem.set(codigo, { jid: String(jid || ''), criadoEm: Date.now(), conteudo: textoOriginal.slice(0, 3500) });
    while (historicoCodigosMensagem.size > LIMITE_CODIGOS_MENSAGEM) historicoCodigosMensagem.delete(historicoCodigosMensagem.keys().next().value);
    console.log(`[WABOT] Código de mensagem gerado: ${codigo}`);
    const seloNatal = estaNaEdicaoNatalina() ? '🎄 *WABOT • EDIÇÃO DE NATAL* 🎄\n\n' : '';
    const sufixo = `\n\n🔎 Código da mensagem: *${codigo}*`;
    if (typeof saida.text === 'string') {
        saida.text = `${seloNatal}${saida.text}${sufixo}`;
    }
    if (typeof saida.caption === 'string') {
        saida.caption = `${seloNatal}${saida.caption}${sufixo}`;
    }
    return saida;
}

async function gerarImagemPresenteNatal(nome, recompensa, extra) {
    const nomeSeguro = escaparSVG(String(nome || 'Pescador').slice(0, 24));
    const detalhe = extra ? 'BÔNUS SURPRESA ENCONTRADO!' : 'UM PRESENTE ESPECIAL PARA VOCÊ';
    const svg = `<svg width="1080" height="720" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#082D25"/><stop offset=".55" stop-color="#14543B"/><stop offset="1" stop-color="#071B25"/></linearGradient><linearGradient id="gold"><stop stop-color="#FFF0A6"/><stop offset="1" stop-color="#D9A83E"/></linearGradient></defs><rect width="1080" height="720" fill="url(#bg)"/><circle cx="110" cy="90" r="180" fill="#FFFFFF" opacity=".04"/><circle cx="970" cy="620" r="240" fill="#FFFFFF" opacity=".04"/><path d="M0 570 Q220 510 430 585 T1080 565 V720 H0Z" fill="#0A332A"/><g fill="#F7E6B5" opacity=".9"><circle cx="120" cy="210" r="5"/><circle cx="920" cy="150" r="7"/><circle cx="840" cy="350" r="4"/><circle cx="230" cy="440" r="4"/><circle cx="730" cy="90" r="5"/></g><text x="540" y="105" text-anchor="middle" fill="#F6D77B" font-family="DejaVu Sans, sans-serif" font-size="27" letter-spacing="8" font-weight="bold">CORREIO DO POLO NORTE</text><text x="540" y="165" text-anchor="middle" fill="#FFFFFF" font-family="DejaVu Sans, sans-serif" font-size="48" font-weight="bold">PRESENTE DE NATAL</text><g transform="translate(540 390)"><ellipse cx="0" cy="165" rx="205" ry="30" fill="#031A17" opacity=".5"/><rect x="-155" y="-85" width="310" height="230" rx="22" fill="#B72F45" stroke="#F5D77A" stroke-width="8"/><rect x="-30" y="-85" width="60" height="230" fill="#E8C65D"/><rect x="-155" y="-10" width="310" height="48" fill="#E8C65D"/><path d="M0 -85 C-150 -210 -185 -65 -75 -48 C-40 -42 -10 -62 0 -85 C10 -62 40 -42 75 -48 C185 -65 150 -210 0 -85Z" fill="#D9B34D" stroke="#F8E6A5" stroke-width="7"/></g><text x="540" y="590" text-anchor="middle" fill="#F6D77B" font-family="DejaVu Sans, sans-serif" font-size="25" font-weight="bold">${detalhe}</text><text x="540" y="635" text-anchor="middle" fill="#FFFFFF" font-family="DejaVu Sans, sans-serif" font-size="22">${nomeSeguro} • +${recompensa} WACoins</text></svg>`;
    return sharp(Buffer.from(aplicarMolduraNatalSVG(svg))).png({ compressionLevel: 9 }).toBuffer();
}


// ==================================================
// INTERPRETADOR FLEXÍVEL DE COMANDOS — V3.2.1
// ==================================================

const COMANDOS_RECONHECIDOS = new Set(['!temporadapesca', '!tripulacao', '!8ball', '!aceitarvelha', '!anagrama', '!aprovar', '!banco', '!bio', '!cancelarentrevista', '!cancelarloja', '!cargo', '!chefe', '!chefemundial', '!chutarpalavra', '!comandos', '!comprarperfil', '!comprarpesca', '!conquistas', '!dado', '!depositar', '!desanagrama', '!desistirvelha', '!diario', '!divulgar', '!doar', '!duelo', '!eleicao', '!erros', '!codigos', '!codigo', '!buscarcodigo', '!entrevista', '!entrevistas', '!equiparperfil', '!escolher', '!evento', '!eventopesca', '!eventotempo', '!figurinha', '!forca', '!forjar', '!masmorra', '!frase', '!grupo', '!guilda', '!guildas', '!help', '!helprpg', '!id', '!info', '!inventarioperfil', '!jogarvelha', '!letra', '!limpar', '!limparmax', '!lojaperfil', '!lojapesca', '!mar', '!mares', '!mercado', '!missao', '!missoes', '!moeda', '!par', '!partido', '!peixes', '!presente', '!perfil', '!pescar', '!ping', '!poker', '!poderpolitico', '!politica', '!proposta', '!pvp', '!quiz', '!quizhard', '!quizparar', '!rankingpesca', '!rankingquiz', '!reagir', '!recompensadiaria', '!recusarvelha', '!renascerpesca', '!renascimento', '!reprovar', '!resetagendar', '!resgatar', '!resposta', '!resultado', '!rodadasorte', '!roleta', '!rpg', '!saldo', '!sequencia', '!ship', '!sobre', '!sorte', '!sorteio', '!statusperfil', '!tempoevento', '!tirarreacao', '!upd', '!uptime', '!velha', '!venderpeixes', '!video', '!votar', '!wacoins']);

function mensagemTemPrefixo(texto) {
    return /^!\s*\S/.test(String(texto ?? '').trimStart());
}

function distanciaEdicao(a, b) {
    a = String(a); b = String(b);
    const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let diagonal = linha[0];
        linha[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const acima = linha[j];
            linha[j] = Math.min(
                linha[j] + 1,
                linha[j - 1] + 1,
                diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
            diagonal = acima;
        }
    }
    return linha[b.length];
}

function interpretarComando(texto) {
    // Extrai o comando e preserva todo o restante da mensagem como argumentos.
    // Isso evita perder subcomandos como "ranking" em !politica ranking.
    const bruto = String(texto ?? '').trim();
    const limpo = bruto.replace(/^!\s*/, '!').replace(/[\t\r\n ]+/g, ' ');
    const correspondencia = limpo.match(/^(![^\s]+)(?:\s+([\s\S]*))?$/);

    if (!correspondencia) {
        return { comando: normalizar(limpo), args: [], original: normalizar(limpo), corrigido: false, sugestao: null, textoArgumentos: '' };
    }

    let comando = normalizar(correspondencia[1]);
    const textoArgumentos = String(correspondencia[2] || '').trim();
    const args = textoArgumentos ? textoArgumentos.split(/\s+/) : [];

    if (COMANDOS_RECONHECIDOS.has(comando)) {
        return { comando, args, original: comando, corrigido: false, sugestao: null, textoArgumentos };
    }

    // Só corrige erros pequenos e inequívocos no nome principal do comando.
    const candidatos = [...COMANDOS_RECONHECIDOS]
        .map(opcao => ({ opcao, distancia: distanciaEdicao(comando, opcao) }))
        .filter(item => item.distancia <= (comando.length <= 5 ? 1 : 2))
        .sort((a, b) => a.distancia - b.distancia || a.opcao.localeCompare(b.opcao));

    if (candidatos.length && (candidatos.length === 1 || candidatos[0].distancia < candidatos[1].distancia)) {
        const original = comando;
        comando = candidatos[0].opcao;
        return { comando, args, original, corrigido: true, sugestao: comando, textoArgumentos };
    }

    return { comando, args, original: comando, corrigido: false, sugestao: candidatos[0]?.opcao || null, textoArgumentos };
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
    sistemasV310.mercado ||= []; sistemasV310.guildas ||= {}; sistemasV310.membrosGuilda ||= {}; sistemasV310.tripulacoes ||= {}; sistemasV310.membrosTripulacao ||= {}; sistemasV310.chefes ||= {}; sistemasV310.desafiosPVP ||= {}; sistemasV310.recompensasDiarias ||= {}; sistemasV310.resetAgendado ||= {}; sistemasV310.resetHistorico ||= []; sistemasV310.politica ||= { grupos: {} }; sistemasV310.politica.grupos ||= {};
    sistemasV310.tripulacoes ||= {}; sistemasV310.membrosTripulacao ||= {};
    sistemasV310.temporadaPesca ||= {}; sistemasV310.cidades ||= {}; sistemasV310.membrosCidade ||= {};
    const politicaMigrada = migrarPoliticaParaGlobal();
    if (politicaMigrada) await salvarSistemas310();
    await migrarEconomiaParaWACoins();
    if (migracaoPeixesAntigos) await salvarDadosPesca();
    await verificarResetTemporadaPesca(false);
    manutencaoAtiva = Boolean(carteirasWACoins.__manutencao_ativa);
    for (const entrevista of Object.values(historicoEntrevistas)) {
        if (entrevista?.status === 'em_andamento' && entrevista.grupoJid) {
            entrevistasAtivas.set(entrevista.grupoJid, entrevista);
        }
    }
}

function encontrarChaveUsuario(objeto, id) {
    if (!objeto || !id) return null;
    if (Object.prototype.hasOwnProperty.call(objeto, id)) return id;
    return Object.keys(objeto).find(chave => mesmoUsuario(chave, id)) || null;
}

function mesmoUsuario(a, b) {
    if (!a || !b) return false;
    const limpar = valor => String(valor).split(':')[0].toLowerCase();
    const resolver = valor => {
        let atual = limpar(valor);
        const vistos = new Set();
        while (aliasesUsuarios.has(atual) && !vistos.has(atual)) {
            vistos.add(atual);
            const proximo = aliasesUsuarios.get(atual);
            if (!proximo || proximo === atual) break;
            atual = proximo;
        }
        return atual;
    };
    const A = limpar(a), B = limpar(b);
    if (A === B || resolver(A) === resolver(B)) return true;
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
    const participante = msg.key?.participant || '';
    const alternativo = msg.key?.participantAlt || '';
    if (participante && alternativo) {
        const a = String(participante).split(':')[0].toLowerCase();
        const b = String(alternativo).split(':')[0].toLowerCase();
        aliasesUsuarios.set(a,a); aliasesUsuarios.set(b,a);
    }
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
            const ids = [participante.id, participante.jid, participante.phoneNumber].filter(Boolean).map(x=>String(x).split(':')[0].toLowerCase());
            if (ids.length) { aliasesUsuarios.set(ids[0],ids[0]); for (const a of ids.slice(1)) aliasesUsuarios.set(a,ids[0]); }
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
            marPesca: 'costa',
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
    jogador.marPesca = MARES_PESCA?.[jogador.marPesca] ? jogador.marPesca : 'costa';
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

🌊 Mar atual: *${MARES_PESCA[obterMarPesca(jogador)].nome}*
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


function obterEventoTematicoCalendario(data = new Date()) {
    const iso = dataLocalISO(data);
    const mmdd = iso.slice(5);
    const eventos = [
        { tipo:'natal', nome:'Natal dos Oceanos', emoji:'🎄', bonusSorte:6, inicio:'11-22', fim:'01-02', atravessaAno:true },
        { tipo:'ano_novo', nome:'Virada das Marés', emoji:'🎆', bonusSorte:5, inicio:'01-02', fim:'01-08' },
        { tipo:'carnaval', nome:'Carnaval Aquático', emoji:'🎭', bonusSorte:4, inicio:'02-10', fim:'02-18' },
        { tipo:'pascoa', nome:'Páscoa Submarina', emoji:'🐰', bonusSorte:5, inicio:'03-20', fim:'04-05' },
        { tipo:'junina', nome:'Arraiá das Águas', emoji:'🌽', bonusSorte:4, inicio:'06-10', fim:'07-01' },
        { tipo:'primavera', nome:'Primavera Oceânica', emoji:'🌸', bonusSorte:4, inicio:'09-20', fim:'10-06' },
        { tipo:'halloween', nome:'Halloween das Profundezas', emoji:'🎃', bonusSorte:5, inicio:'10-20', fim:'11-03' }
    ];
    for (const ev of eventos) {
        let ativo = false;
        if (ev.atravessaAno) ativo = mmdd >= ev.inicio || mmdd < ev.fim;
        else ativo = mmdd >= ev.inicio && mmdd < ev.fim;
        // Primeira edição de Natal começa em 22/11/2026 e termina em 02/01/2027.
        if (ev.tipo === 'natal' && iso < '2026-11-22') ativo = false;
        if (ativo) {
            const anoFim = ev.atravessaAno && mmdd >= ev.inicio ? data.getFullYear()+1 : data.getFullYear();
            const fim = new Date(`${anoFim}-${ev.fim}T00:00:00-03:00`).getTime();
            return { ...ev, iniciadoEm: Date.now(), terminaEm: fim, tematico:true };
        }
    }
    return null;
}

function obterEventoPescaAtivo() {
    const evento = carteirasWACoins.__evento_pesca;
    if (evento && evento.terminaEm && Date.now() < evento.terminaEm) return evento;
    if (evento) { delete carteirasWACoins.__evento_pesca; salvarWACoins().catch(() => {}); }
    return obterEventoTematicoCalendario();
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
    ],
    natal: [
        { nome: 'Peixe-Presente', raridade: 'raro', valor: 1800 },
        { nome: 'Rena-Marinha', raridade: 'epico', valor: 6500 },
        { nome: 'Baleia Estrela de Natal', raridade: 'lendario', valor: 22000 },
        { nome: 'Guardião do Polo Azul', raridade: 'divina', valor: 65000 }
    ],
    ano_novo: [
        { nome: 'Peixe-Fogos de Artifício', raridade: 'epico', valor: 3500 },
        { nome: 'Carpa da Virada', raridade: 'lendario', valor: 14000 },
        { nome: 'Cometa de Ano Novo', raridade: 'divina', valor: 45000 }
    ],
    carnaval: [
        { nome: 'Peixe-Máscara', raridade: 'raro', valor: 1200 },
        { nome: 'Polvo do Samba', raridade: 'epico', valor: 5000 },
        { nome: 'Rei Momo dos Mares', raridade: 'lendario', valor: 18000 }
    ],
    pascoa: [
        { nome: 'Coelho-d água', raridade: 'raro', valor: 1400 },
        { nome: 'Ovo de Coral', raridade: 'epico', valor: 5200 },
        { nome: 'Lebre Dourada Abissal', raridade: 'lendario', valor: 19000 }
    ],
    junina: [
        { nome: 'Sardinha Caipira', raridade: 'raro', valor: 1000 },
        { nome: 'Pirarucu da Fogueira', raridade: 'epico', valor: 4800 },
        { nome: 'Balão Celeste', raridade: 'lendario', valor: 17000 }
    ],
    primavera: [
        { nome: 'Peixe-Pétala', raridade: 'raro', valor: 1300 },
        { nome: 'Cavalo-marinho Florido', raridade: 'epico', valor: 4700 },
        { nome: 'Jardim Vivo do Oceano', raridade: 'lendario', valor: 16500 }
    ],
    halloween: [
        { nome: 'Peixe-Lanterna Assombrado', raridade: 'raro', valor: 1600 },
        { nome: 'Lula Fantasma', raridade: 'epico', valor: 6000 },
        { nome: 'Leviatã da Meia-Noite', raridade: 'divina', valor: 32000 }
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

const MARES_PESCA = {
    costa: {
        nome: 'Costa Inicial', emoji: '🏝️', renascimentos: 0, multiplicador: 1,
        peixes: {
            comum: [{nome:'Sardinha-dourada',valor:8},{nome:'Peixe-pedra',valor:10}],
            incomum: [{nome:'Robalo-listrado',valor:45},{nome:'Garoupa-jovem',valor:55}],
            raro: [{nome:'Raia-azul',valor:150},{nome:'Tubarão-de-recife',valor:180}],
            epico: [{nome:'Tartaruga-coroada',valor:380}],
            lendario: [{nome:'Rei das Ondas',valor:1200}],
            divina: [{nome:'Espírito da Costa',valor:7000}]
        }
    },
    tropical: {
        nome: 'Mar Tropical', emoji: '🌴', renascimentos: 1, multiplicador: 1.6,
        peixes: {
            comum: [{nome:'Peixe-borboleta',valor:18},{nome:'Peixe-papagaio',valor:22}],
            incomum: [{nome:'Moreia-dourada',valor:95},{nome:'Peixe-anjo-real',valor:110}],
            raro: [{nome:'Manta-tropical',valor:330},{nome:'Tubarão-de-pontas-negras',valor:390}],
            epico: [{nome:'Cavalo-marinho-imperial',valor:850}],
            lendario: [{nome:'Dragão dos Recifes',valor:2800}],
            divina: [{nome:'Deusa das Marés Tropicais',valor:16000}]
        }
    },
    profundo: {
        nome: 'Oceano Profundo', emoji: '🐋', renascimentos: 3, multiplicador: 2.6,
        peixes: {
            comum: [{nome:'Peixe-lanterna-pequeno',valor:35},{nome:'Enguia-prateada',valor:42}],
            incomum: [{nome:'Peixe-machado-gigante',valor:180},{nome:'Lula-de-vidro',valor:210}],
            raro: [{nome:'Quimera-marinha',valor:650},{nome:'Tubarão-cinzento-abissal',valor:780}],
            epico: [{nome:'Lula-fantasma',valor:1900},{nome:'Baleia-sombria',valor:2300}],
            lendario: [{nome:'Guardião da Fenda',valor:8500}],
            divina: [{nome:'Olho do Oceano',valor:45000}]
        }
    },
    abissal: {
        nome: 'Mar Abissal', emoji: '🕳️', renascimentos: 5, multiplicador: 4.2,
        peixes: {
            comum: [{nome:'Peixe-cego-abissal',valor:55},{nome:'Camarão-fóssil',valor:65}],
            incomum: [{nome:'Polvo-de-carvão',valor:300},{nome:'Peixe-dente-de-sabre',valor:360}],
            raro: [{nome:'Peixe-dragão-negro',valor:1100},{nome:'Aranha-do-mar-gigante',valor:1350}],
            epico: [{nome:'Serpente da Trincheira',valor:4200}],
            lendario: [{nome:'Colosso do Vazio',valor:18000}],
            divina: [{nome:'Coração do Abismo',valor:95000}]
        }
    },
    celestial: {
        nome: 'Mar Celestial', emoji: '🌌', renascimentos: 10, multiplicador: 7,
        peixes: {
            comum: [{nome:'Peixe-estelar',valor:90},{nome:'Medusa-luminosa',valor:110}],
            incomum: [{nome:'Carpa-nebulosa',valor:520},{nome:'Enguia-celeste',valor:650}],
            raro: [{nome:'Raia-cometa',valor:1800},{nome:'Tubarão-astral',valor:2200}],
            epico: [{nome:'Baleia das Constelações',valor:8000}],
            lendario: [{nome:'Imperador das Galáxias',valor:42000}],
            divina: [{nome:'Criador do Mar Celestial',valor:220000}]
        }
    },
    infinito: {
        nome: 'Mar do Infinito', emoji: '♾️', renascimentos: 15, multiplicador: 12,
        peixes: {
            comum: [{nome:'Fragmento-vivo do Infinito',valor:150},{nome:'Peixe-dimensional',valor:180}],
            incomum: [{nome:'Serpente entre Mundos',valor:900},{nome:'Náutilo eterno',valor:1100}],
            raro: [{nome:'Leviatã dimensional',valor:3600},{nome:'Tubarão do Vazio',valor:4300}],
            epico: [{nome:'Devorador de Horizontes',valor:16000}],
            lendario: [{nome:'O Primeiro Leviatã',valor:90000}],
            divina: [{nome:'O Infinito Azul',valor:500000}]
        }
    }
};

const pendingRenascimentosPesca = new Map();

function obterMarPesca(jogador) {
    const chave = String(jogador?.marPesca || 'costa');
    return MARES_PESCA[chave] ? chave : 'costa';
}

function montarListaMaresPesca(jogador) {
    const renascimentos = Number(jogador.renascimentos) || 0;
    const atual = obterMarPesca(jogador);
    const linhas = Object.entries(MARES_PESCA).map(([id, mar]) => {
        const desbloqueado = renascimentos >= mar.renascimentos;
        const marcador = id === atual ? '📍' : desbloqueado ? '✅' : '🔒';
        return `${marcador} *${mar.nome}* — ${mar.renascimentos} renascimento(s)${desbloqueado ? ` | x${mar.multiplicador} no valor` : ` | faltam ${mar.renascimentos - renascimentos}`}`;
    });
    return `🌊 *MAPA DOS MARES*\n\nRenascimentos: *${renascimentos}*\nMar atual: *${MARES_PESCA[atual].nome}*\n\n${linhas.join('\n')}\n\nPara viajar: *!mar nome* (ex.: !mar tropical).`;
}

async function selecionarMarPesca(sock, jid, id, nome, argumento) {
    const jogador = obterDadosPescador(id, nome);
    const chave = normalizar(argumento || '');
    if (!chave) return texto(sock, jid, montarListaMaresPesca(jogador));
    const aliases = {
        costa:'costa', inicial:'costa', tropical:'tropical', profundo:'profundo', oceano:'profundo',
        abissal:'abissal', celestial:'celestial', infinito:'infinito'
    };
    const marId = aliases[chave];
    if (!marId || !MARES_PESCA[marId]) return texto(sock, jid, `❌ Mar não encontrado.\n\n${montarListaMaresPesca(jogador)}`);
    const mar = MARES_PESCA[marId];
    if ((Number(jogador.renascimentos) || 0) < mar.renascimentos) {
        return texto(sock, jid, `🔒 *${mar.nome} BLOQUEADO*\n\nNecessário: ${mar.renascimentos} renascimento(s).\nVocê possui: ${jogador.renascimentos || 0}.\n\nUse !renascerpesca para evoluir.`);
    }
    jogador.marPesca = marId;
    await salvarDadosPesca();
    return texto(sock, jid, `${mar.emoji} *VIAGEM CONCLUÍDA!*\n\nVocê agora está pescando em *${mar.nome}*.\n💰 Valor dos peixes: multiplicador x${mar.multiplicador}.\n🎣 Use !pescar para começar.`);
}

function obterRequisitosRenascimentoPesca(jogador) {
    const proximo = (Number(jogador.renascimentos) || 0) + 1;
    return {
        numero: proximo,
        capturas: 100 + (proximo - 1) * 50,
        peixes: 10 + (proximo - 1) * 5,
        dinheiro: Math.round(5000 * Math.pow(1.55, proximo - 1))
    };
}

function obterChaveCarteiraUsuario(id) {
    if (carteirasWACoins[id]) return id;
    return Object.keys(carteirasWACoins).find(chave => !chave.startsWith('__') && mesmoUsuario(chave, id)) || id;
}

function sortearPeixe(raridade, nivelLinha = 0, jogador = null) {
    const profundidade = Math.max(0, Math.min(5, Number(nivelLinha) || 0));
    const extras = [];
    for (let nivel = 2; nivel <= profundidade; nivel++) {
        const lista = PEIXES_PROFUNDIDADE[nivel]?.[raridade] || [];
        extras.push(...lista);
    }
    const mar = MARES_PESCA[obterMarPesca(jogador)];
    const peixesDoMar = mar?.peixes?.[raridade] || [];
    return aleatorio([...(peixesDisponiveis[raridade] || []), ...extras, ...peixesDoMar]);
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
        const peixe = peixeEvento || sortearPeixe(raridade, jogador.equipamentos.linha, jogador);
        const marAtual = MARES_PESCA[obterMarPesca(jogador)];
        const valorPeixeMar = Math.round((Number(peixe.valor) || 0) * (marAtual?.multiplicador || 1));
        const pesoBase = calcularPesoPesca(raridade);
        const bonusProfundidade = 1 + (Math.max(0, Number(jogador.equipamentos.linha) || 0) * 0.12);
        const peso = Math.round(pesoBase * bonusProfundidade * (1 + calcularBonusPesoPesca(jogador)));

        const bonusPeso = Math.floor(peso / 100);
        const moedasGanhas = valorPeixeMar + bonusPeso;

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
        const chaveTripulacao = encontrarChaveUsuario(sistemasV310.membrosTripulacao || {}, id);
        const tripulacao = chaveTripulacao ? sistemasV310.tripulacoes?.[sistemasV310.membrosTripulacao[chaveTripulacao]] : null;
        if (tripulacao) {
            tripulacao.pontos = (Number(tripulacao.pontos) || 0) + Math.max(1, Math.floor(moedasGanhas / 10));
            tripulacao.capturas = (Number(tripulacao.capturas) || 0) + 1;
            tripulacao.ultimaCapturaEm = Date.now();
        }
        let itemEventoRecebido = null;
        if (evento && randomInt(1, 101) <= 18) {
            const catalogoItensEvento = {
                taco: { nome: 'Amuleto Taco', bonusSorte: 1 },
                mare: { nome: 'Amuleto da Maré', bonusSorte: 1 },
                estrelas: { nome: 'Fragmento Estelar', bonusSorte: 1 },
                abismo: { nome: 'Relíquia Abissal', bonusSorte: 1 },
                natal: { nome: 'Estrela de Natal', bonusSorte: 1 },
                ano_novo: { nome: 'Fragmento da Virada', bonusSorte: 1 },
                carnaval: { nome: 'Máscara Oceânica', bonusSorte: 1 },
                pascoa: { nome: 'Ovo de Coral', bonusSorte: 1 },
                junina: { nome: 'Fogueira Azul', bonusSorte: 1 },
                primavera: { nome: 'Pétala Marinha', bonusSorte: 1 },
                halloween: { nome: 'Essência Assombrada', bonusSorte: 1 }
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

        await Promise.all([salvarDadosPesca(), salvarSistemas310()]);

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
🌊 Mar: ${marAtual.nome}

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
        return `🎣 *COLEÇÃO DE ${jogador.nome.toUpperCase()}*\n🌊 Mar atual: ${MARES_PESCA[obterMarPesca(jogador)].nome}\n\nVocê ainda não capturou nenhum peixe.\n\nUse !pescar para começar!${itensEvento}`;
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
🌊 Mar atual: ${MARES_PESCA[obterMarPesca(jogador)].nome}

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
    return sharp(Buffer.from(aplicarMolduraNatalSVG(svg))).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
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
// PERSISTÊNCIA AGRUPADA DO HISTÓRICO DE MENSAGENS
// ==================================================

function agendarSalvamentoMensagens() {
    mensagensPrecisamSalvar = true;
    if (timerSalvarMensagens) clearTimeout(timerSalvarMensagens);
    timerSalvarMensagens = setTimeout(() => {
        timerSalvarMensagens = null;
        salvarMensagensPendente().catch(erro => console.error('[PERSISTÊNCIA] Falha ao salvar histórico de mensagens:', erro?.stack || erro));
    }, INTERVALO_DEBOUNCE_MENSAGENS);
    timerSalvarMensagens.unref?.();
}

async function salvarMensagensPendente() {
    if (salvandoMensagens) return promessaSalvarMensagens;
    if (timerSalvarMensagens) { clearTimeout(timerSalvarMensagens); timerSalvarMensagens = null; }
    if (!mensagensPrecisamSalvar) return;
    salvandoMensagens = true;
    mensagensPrecisamSalvar = false;
    const tarefa = (async () => {
        try {
            await salvarJSON(ARQUIVO_MENSAGENS, mensagensComando);
        } catch (erro) {
            mensagensPrecisamSalvar = true;
            throw erro;
        } finally {
            salvandoMensagens = false;
            promessaSalvarMensagens = null;
            if (mensagensPrecisamSalvar && !timerSalvarMensagens) {
                timerSalvarMensagens = setTimeout(() => {
                    timerSalvarMensagens = null;
                    salvarMensagensPendente().catch(erro => console.error('[PERSISTÊNCIA] Falha ao repetir gravação:', erro?.message || erro));
                }, 2000);
                timerSalvarMensagens.unref?.();
            }
        }
    })();
    promessaSalvarMensagens = tarefa;
    return tarefa;
}

// ==================================================
// ENVIO DE MENSAGENS
// ==================================================

async function enviar(sock, jid, conteudo, registrar = true) {
    const conteudoDecorado = decorarSaidaWABOT(conteudo, jid);
    const enviada = await sock.sendMessage(jid, conteudoDecorado);

    if (registrar && enviada?.key?.id) {
        if (!mensagensComando[jid]) {
            mensagensComando[jid] = [];
        }

        mensagensComando[jid].push(enviada.key);
        mensagensComando[jid] = mensagensComando[jid].slice(-MAX_MENSAGENS_HISTORICO_POR_CONVERSA);

        // Não bloqueia a resposta do WhatsApp esperando a regravação do JSON inteiro.
        // Várias mensagens são agrupadas em uma única gravação curta.
        const conversas = Object.keys(mensagensComando);
        while (conversas.length > MAX_CONVERSAS_HISTORICO) {
            const antiga = conversas.shift();
            if (antiga !== jid) delete mensagensComando[antiga];
        }
        agendarSalvamentoMensagens();
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

    mensagensPrecisamSalvar = true;
    await salvarMensagensPendente();

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
            input: Buffer.from(aplicarMolduraNatalSVG(svg)),
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

    const base = await sharp(Buffer.from(aplicarMolduraNatalSVG(svg))).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
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
    return sharp(Buffer.from(aplicarMolduraNatalSVG(svg))).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
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
    return sharp(Buffer.from(aplicarMolduraNatalSVG(svg))).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
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

const RPG_CLASSES = {
    guerreiro: { nome: 'Guerreiro', passiva: '+12% de dano físico', habilidade: 'Fúria: próximo ataque causa 75% de dano adicional.' },
    mago: { nome: 'Mago', passiva: '+15% de poder mágico', habilidade: 'Sobrecarga: próxima magia recebe +50% de poder.' },
    guardiao: { nome: 'Guardião', passiva: '+15% de defesa efetiva', habilidade: 'Barreira: reduz em 65% o próximo dano recebido durante 1 minuto.' },
    ladino: { nome: 'Ladino', passiva: '15% de chance de causar dano crítico', habilidade: 'Emboscada: garante crítico no próximo ataque.' }
};

const RPG_INIMIGOS = [
    { nome: 'Slime da Floresta', hp: 32, ataque: 7, defesa: 1, xp: 22, moedas: 14, habilidade: 'Ácido viscoso' },
    { nome: 'Lobo Cinzento', hp: 46, ataque: 10, defesa: 2, xp: 32, moedas: 22, habilidade: 'Investida feroz' },
    { nome: 'Goblin Saqueador', hp: 58, ataque: 12, defesa: 3, xp: 42, moedas: 30, habilidade: 'Golpe oportunista' },
    { nome: 'Golem de Pedra', hp: 85, ataque: 15, defesa: 6, xp: 65, moedas: 48, habilidade: 'Pele de pedra' },
    { nome: 'Cavaleiro Esquecido', hp: 110, ataque: 19, defesa: 7, xp: 90, moedas: 70, habilidade: 'Corte espectral' },
    { nome: 'Hidra de Três Ecos', hp: 165, ataque: 25, defesa: 9, xp: 145, moedas: 125, habilidade: 'Mordida tripla', estilo:'agressivo' },
    { nome: 'Mímico Ancestral', hp: 190, ataque: 22, defesa: 14, xp: 170, moedas: 155, habilidade: 'Armadilha de ouro', estilo:'tatico' },
    { nome: 'Arcanjo Corrompido', hp: 230, ataque: 31, defesa: 12, xp: 220, moedas: 210, habilidade: 'Lança celestial', estilo:'arcano' },
    { nome: 'Devorador de Mundos', hp: 310, ataque: 36, defesa: 16, xp: 300, moedas: 290, habilidade: 'Fome do vazio', estilo:'venenoso' },
    { nome: 'Rei das Profundezas', hp: 420, ataque: 43, defesa: 20, xp: 420, moedas: 400, habilidade: 'Maré devastadora', estilo:'agressivo' }
];

const RPG_ITENS = {
    pocao: { nome: 'Poção de vida', preco: 25, tipo: 'consumivel', cura: 45 },
    pocao_grande: { nome: 'Poção grande', preco: 60, tipo: 'consumivel', cura: 100 },
    espada: { nome: 'Espada de ferro', preco: 100, tipo: 'arma', ataque: 5 },
    espada_lunar: { nome: 'Espada lunar', preco: 280, tipo: 'arma', ataque: 12 },
    escudo: { nome: 'Escudo de ferro', preco: 120, tipo: 'armadura', defesa: 4 },
    escudo_real: { nome: 'Escudo real', preco: 320, tipo: 'armadura', defesa: 9 },
    espada_runica: { nome: 'Espada rúnica', preco: 0, tipo: 'arma', ataque: 20 },
    escudo_cristal: { nome: 'Escudo de cristal', preco: 0, tipo: 'armadura', defesa: 16 },
    liberador: { nome: 'Liberador de poder', preco: 650, tipo: 'consumivel', efeito: 'roleta' }
};

function obterJogadorRPG(id, nome) {
    if (!dadosRPG[id]) {
        dadosRPG[id] = {
            nome, nivel: 1, xp: 0, moedas: 50,
            hp: 100, hpMax: 100, ataque: 10, defesa: 2, pontosEvolucao: 0, evolucoes: { ataque: 0, defesa: 0, vida: 0, magia: 0 },
            inventario: { pocao: 2, liberador: 0 }, equipamento: { arma: null, armadura: null },
            magias: [], poderCopiado: null, zumbi: null, classe: null, habilidadeCooldownAte: 0, bonusProximoAtaque: 1, bonusProximaMagia: 1,
            bonusProximoAtaqueAte: 0, bonusProximaMagiaAte: 0, escudoClasseAte: 0, criticoGarantidoAte: 0, escudoPoliticoAte: 0,
            inimigo: null, progresso: { exploracoes: 0, vitorias: 0, missoesConcluidas: 0 },
            missao: { tipo: 'explorar', meta: 3, progresso: 0, recompensa: 120, xp: 90 }
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
    p.inventario.fragmento_arcano = Math.max(0, Number(p.inventario.fragmento_arcano) || 0);
    p.inventario.nucleo_abissal = Math.max(0, Number(p.inventario.nucleo_abissal) || 0);
    p.masmorra ||= { melhorAndar: 0, vitorias: 0, tentativasDia: 0, dataTentativas: '', comprasDia: 0, dataCompras: '' };
    p.masmorra.comprasDia = Math.max(0, Number(p.masmorra.comprasDia) || 0);
    p.masmorra.dataCompras = String(p.masmorra.dataCompras || '');
    p.masmorra.acessosExtras = Math.max(0, Number(p.masmorra.acessosExtras) || 0);
    p.inventario.liberador = Math.max(0, Number(p.inventario.liberador) || 0);
    p.equipamento ||= { arma: null, armadura: null };
    if (!Array.isArray(p.magias)) p.magias = [];
    p.poderCopiado ||= null;
    p.zumbi ||= null;
    p.classe = ['guerreiro','mago','guardiao','ladino'].includes(p.classe) ? p.classe : null;
    p.habilidadeCooldownAte = Math.max(0, Number(p.habilidadeCooldownAte) || 0);
    p.bonusProximoAtaque = Math.max(1, Number(p.bonusProximoAtaque) || 1);
    p.bonusProximaMagia = Math.max(1, Number(p.bonusProximaMagia) || 1);
    p.bonusProximoAtaqueAte = Math.max(0, Number(p.bonusProximoAtaqueAte) || 0);
    p.bonusProximaMagiaAte = Math.max(0, Number(p.bonusProximaMagiaAte) || 0);
    p.escudoClasseAte = Math.max(0, Number(p.escudoClasseAte) || 0);
    p.criticoGarantidoAte = Math.max(0, Number(p.criticoGarantidoAte) || 0);
    p.escudoPoliticoAte = Math.max(0, Number(p.escudoPoliticoAte) || 0);
    p.progresso ||= { exploracoes: 0, vitorias: 0, missoesConcluidas: 0 };
    p.missao ||= { tipo: 'explorar', meta: 3, progresso: 0, recompensa: 120, xp: 90 };
    // Economia rural e construção: migração aditiva, sem apagar dados antigos.
    p.economia ||= {};
    p.economia.fazendas = Math.max(0, Math.min(3, Number(p.economia.fazendas) || 0));
    p.economia.plantacao ||= null;
    p.economia.emprego ||= null;
    p.economia.trabalhoAte = Math.max(0, Number(p.economia.trabalhoAte) || 0);
    p.economia.recursos ||= { madeira: 0, pedra: 0, trigo: 0, ervas: 0 };
    for (const recurso of ['madeira','pedra','trigo','ervas']) p.economia.recursos[recurso] = Math.max(0, Number(p.economia.recursos[recurso]) || 0);
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
    if (!pacto) return (1 + (Math.max(0, Number(j.evolucoes?.magia) || 0) * 0.05)) * (j.classe === 'mago' ? 1.15 : 1);
    const bonusEvolucao = 1 + (Math.max(0, Number(j.evolucoes?.magia) || 0) * 0.05);
    const bonusClasse = j.classe === 'mago' ? 1.15 : 1;
    const hora = new Date().getHours();
    const dia = hora >= 7 && hora < 18;
    if (pacto === 'pacto_da_lua') return (dia ? 0.88 : 1.20) * bonusEvolucao * bonusClasse;
    return (dia ? 1.20 : 0.88) * bonusEvolucao * bonusClasse;
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
    const bonusTemporario = Date.now() < (j.bonusProximaMagiaAte || 0) ? (Number(j.bonusProximaMagia) || 1) : 1;
    const multiplicadorMagia = obterMultiplicadorMagiaRPG(j) * bonusTemporario;
    if (!magia) return 'Magia não reconhecida. Use !rpg magias.';
    if (!j.magias.includes(chave)) return 'Você ainda não desbloqueou essa magia. Use um Liberador de poder.';
    if (bonusTemporario > 1) { j.bonusProximaMagia = 1; j.bonusProximaMagiaAte = 0; }
    if (j.hp <= 0) return 'Seu personagem precisa estar vivo para conjurar.';
    if (chave === 'bola_de_fogo') {
        if (!j.inimigo) return 'Bola de fogo: não há inimigo em combate. Explore primeiro.';
        const dano = Math.max(1, Math.round((j.ataque * 2.4 + 18) * multiplicadorMagia));
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
        const cura = Math.round(20 * multiplicadorMagia);
        const antes = j.hp;
        j.hp = Math.min(j.hpMax, j.hp + cura);
        if (j.inimigo) j.inimigo.proximoAtaqueReduzido = true;
        return `💧 Você criou e moveu água em uma área de 1 m × 1 m.\n🛡️ A água desviou parte do perigo e recuperou ${j.hp - antes} HP.`;
    }
    if (chave === 'plantificar') {
        const cura = Math.round(30 * multiplicadorMagia);
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
        const multiplicador = multiplicadorMagia;
        const fase = new Date().getHours() >= 7 && new Date().getHours() < 18 ? 'dia' : 'noite';
        return `🌙 Você ativou ${magia.nome}.\n☀️ Período atual: ${fase}.\n⚡ Poder atual: ${Math.round(multiplicador * 100)}% (bônus/penalidade aplicado automaticamente).`;
    }
    return 'Magia não disponível.';
}

function statusRPG(j) {
    return `🧭 *${j.nome.toUpperCase()} — AVENTUREIRO*\n\n⭐ Nível: ${j.nivel}\n✨ XP: ${j.xp}/${xpNecessarioRPG(j.nivel)}\n❤️ Vida: ${j.hp}/${j.hpMax}\n⚔️ Ataque: ${j.ataque}\n🛡️ Defesa: ${j.defesa}\n🌳 Pontos de evolução: ${j.pontosEvolucao||0}\n🪙 Moedas RPG: ${j.moedas}\n🧬 Classe: ${j.classe ? RPG_CLASSES[j.classe].nome : 'Não escolhida'}\n🔮 Magias: ${j.magias.length ? j.magias.map(id => RPG_MAGIAS[id]?.nome || id).join(', ') : 'Nenhuma'}\n⚡ Poder atual: ${Math.round(obterMultiplicadorMagiaRPG(j) * 100)}%\n☠️ Aliado: ${j.zumbi ? `${j.zumbi.nome} (${j.zumbi.vida} turnos)` : 'Nenhum'}\n\n🏆 Vitórias: ${j.progresso.vitorias}\n🗺️ Explorações: ${j.progresso.exploracoes}\n📜 Missões concluídas: ${j.progresso.missoesConcluidas}\n⚔️ Combate: ${j.inimigo ? j.inimigo.nome + ' (' + j.inimigo.hp + ' HP)' : 'Nenhum'}`;
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
    return sharp(Buffer.from(aplicarMolduraNatalSVG(svg))).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
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
    return sharp(Buffer.from(aplicarMolduraNatalSVG(svg))).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
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

async function renascerPesca(sock, jid, id, nome, acao = '') {
    const p = obterDadosPescador(id, nome);
    const requisitos = obterRequisitosRenascimentoPesca(p);
    const chaveCarteira = obterChaveCarteiraUsuario(id);
    const carteira = obterCarteira(id, nome);
    const dinheiroAtual = Math.floor((Number(carteira.saldo) || 0) + (Number(carteira.banco) || 0));
    const peixesAtuais = Array.isArray(p.peixes) ? p.peixes.length : 0;
    const comando = normalizar(acao || '');

    if ((p.renascimentos || 0) >= 20) {
        return texto(sock, jid, '🏆 Você atingiu o limite de 20 renascimentos da pesca e já possui todos os bônus permanentes.');
    }
    if (comando === 'cancelar') {
        pendingRenascimentosPesca.delete(id);
        return texto(sock, jid, '❎ Renascimento cancelado. Seus dados e WACoins continuam intactos.');
    }
    if (comando !== 'confirmar') {
        const faltas = [];
        if (p.capturas < requisitos.capturas) faltas.push(`• Capturas: ${p.capturas}/${requisitos.capturas}`);
        if (peixesAtuais < requisitos.peixes) faltas.push(`• Peixes no inventário: ${peixesAtuais}/${requisitos.peixes}`);
        if (dinheiroAtual < requisitos.dinheiro) faltas.push(`• WACoins (saldo + banco): ${formatarWACoins(dinheiroAtual)} / ${formatarWACoins(requisitos.dinheiro)}`);
        const status = faltas.length ? `\n\n❌ *Ainda faltam requisitos:*\n${faltas.join('\n')}` : '\n\n✅ *Todos os requisitos foram alcançados!*';
        const textoRequisitos = `🌟 *RENASCIMENTO ${requisitos.numero}*\n\n🎣 Capturas necessárias: *${requisitos.capturas}*\n🐟 Peixes que precisam estar no inventário: *${requisitos.peixes}*\n💰 WACoins mínimos (saldo + banco): *${formatarWACoins(requisitos.dinheiro)}*\n\nAo confirmar, você perderá TODOS os seus WACoins (saldo e banco), peixes, capturas, equipamentos, itens de evento e voltará para a Costa Inicial.\n\nVocê manterá seus renascimentos anteriores e receberá bônus permanentes de sorte e peso.${status}`;
        if (faltas.length) return texto(sock, jid, textoRequisitos + '\n\nQuando cumprir tudo, envie *!renascerpesca confirmar*.');
        pendingRenascimentosPesca.set(id, { criadoEm: Date.now(), numero: requisitos.numero });
        return texto(sock, jid, textoRequisitos + '\n\n⚠️ Para executar, envie *!renascerpesca confirmar* em até 2 minutos. Para desistir: *!renascerpesca cancelar*.');
    }

    const pendente = pendingRenascimentosPesca.get(id);
    if (!pendente || Date.now() - pendente.criadoEm > 2 * 60 * 1000 || pendente.numero !== requisitos.numero) {
        pendingRenascimentosPesca.delete(id);
        return texto(sock, jid, '⌛ Não há confirmação válida de renascimento. Envie !renascerpesca para conferir os requisitos novamente.');
    }
    if (p.capturas < requisitos.capturas || peixesAtuais < requisitos.peixes || dinheiroAtual < requisitos.dinheiro) {
        pendingRenascimentosPesca.delete(id);
        return texto(sock, jid, '❌ Seus requisitos mudaram e não são mais suficientes. Envie !renascerpesca para conferir novamente.');
    }

    pendingRenascimentosPesca.delete(id);
    const confirmacao = requisitos.numero;
    const novo = {
        nome: p.nome,
        moedas: 0,
        capturas: 0,
        maiorPeixe: 0,
        marPesca: 'costa',
        peixes: [],
        itensEvento: [],
        bonusSorteEvento: 0,
        renascimentos: confirmacao,
        bonusSorteRenascimento: Math.min(20, (p.bonusSorteRenascimento || 0) + 1),
        bonusPesoRenascimento: Math.min(1, (p.bonusPesoRenascimento || 0) + 0.05),
        equipamentos: { vara: 'basica', isca: 'comum', linha: 0, amuleto: 0, anel: 0, relicario: 0, pingente: 0, acelerador: 0, peso: 0 }
    };
    dadosPesca[id] = novo;
    // WACoins são a moeda compartilhada do bot; o renascimento zera saldo e banco.
    const carteiraReal = carteirasWACoins[chaveCarteira] || carteira;
    carteiraReal.saldo = 0;
    carteiraReal.banco = 0;
    carteiraReal.ultimaAtualizacaoBanco = Date.now();
    cooldownPesca.delete(id);
    await Promise.all([salvarDadosPesca(), salvarWACoins()]);
    return texto(sock, jid, `🌟 *RENASCIMENTO ${confirmacao} CONCLUÍDO!*\n\nVocê voltou para a *Costa Inicial*.\n🪙 WACoins zerados: saldo e banco.\n🐟 Coleção, capturas e equipamentos reiniciados.\n🍀 Bônus permanente de sorte: +${novo.bonusSorteRenascimento}\n⚖️ Bônus permanente de peso: +${Math.round(novo.bonusPesoRenascimento * 100)}%\n\nUse !mares para ver os mares. Próximo renascimento: ${obterRequisitosRenascimentoPesca(novo).capturas} capturas, ${obterRequisitosRenascimentoPesca(novo).peixes} peixes e ${formatarWACoins(obterRequisitosRenascimentoPesca(novo).dinheiro)}.`);
}

async function verificarResetTemporadaPesca(notificar = false, sock = null) {
    const mesAtual = dataLocalISO().slice(0, 7);
    sistemasV310.temporadaPesca ||= {};
    const estado = sistemasV310.temporadaPesca;
    if (!estado.mesAtual) {
        estado.mesAtual = mesAtual;
        estado.numeroTemporada = Math.max(1, Number(estado.numeroTemporada) || 1);
        estado.iniciadoEm = Date.now();
        await salvarSistemas310();
        return false;
    }
    if (estado.mesAtual === mesAtual) return false;

    const agora = Date.now();
    const sufixo = new Date(agora).toISOString().replace(/[:.]/g, '-');
    await writeFile(path.join(DIRETORIO, `backup-temporada-pesca-${sufixo}.json`), JSON.stringify(dadosPesca, null, 2), 'utf8');
    for (const [id, antigo] of Object.entries(dadosPesca)) {
        const nome = antigo?.nome || nomeExibicao(id);
        dadosPesca[id] = {
            nome, moedas:0, capturas:0, maiorPeixe:0, marPesca:'costa', peixes:[], itensEvento:[], bonusSorteEvento:0,
            renascimentos:Number(antigo?.renascimentos)||0,
            bonusSorteRenascimento:Number(antigo?.bonusSorteRenascimento)||0,
            bonusPesoRenascimento:Number(antigo?.bonusPesoRenascimento)||0,
            equipamentos:{vara:'basica',isca:'comum',linha:0,amuleto:0,anel:0,relicario:0,pingente:0,acelerador:0,peso:0}
        };
    }
    cooldownPesca.clear(); pescariasEmAndamento.clear();
    for (const trip of Object.values(sistemasV310.tripulacoes || {})) { trip.pontos = 0; trip.capturas = 0; trip.resetTemporadaEm = agora; }
    estado.mesAnterior = estado.mesAtual;
    estado.mesAtual = mesAtual;
    estado.numeroTemporada = (Number(estado.numeroTemporada)||1) + 1;
    estado.iniciadoEm = agora;
    estado.ultimoResetEm = agora;
    estado.historico ||= [];
    estado.historico.push({ mes:mesAtual, data: new Date(agora).toISOString(), jogadores:Object.keys(dadosPesca).length });
    estado.historico = estado.historico.slice(-24);
    await Promise.all([salvarDadosPesca(), salvarSistemas310()]);
    if (notificar && sock) console.log(`[PESCA] Temporada ${estado.numeroTemporada} iniciada: ${mesAtual}. Backup da temporada anterior criado.`);
    return true;
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
    let ultimaChecagemTemporada = 0;
    timerResetAgendado = setInterval(async () => {
        try {
            const agora = Date.now();
            if (agora - ultimaChecagemTemporada >= 60 * 60 * 1000) {
                ultimaChecagemTemporada = agora;
                await verificarResetTemporadaPesca(true, sock);
            }
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

// ==================================================
// POLÍTICA POR GRUPO: PARTIDOS, ELEIÇÕES E MANDATOS
// ==================================================

function migrarPoliticaParaGlobal() {
    sistemasV310.politica ||= { grupos: {} };
    const politica = sistemasV310.politica;
    politica.grupos ||= {};
    let mudou = false;

    if (!politica.global || typeof politica.global !== 'object') {
        politica.global = { partidos: {}, membros: {}, eleicao: null, mandato: null, propostas: [], historico: [], mandatosPorUsuario: {} };
        mudou = true;
    }

    const global = politica.global;
    global.partidos ||= {};
    global.membros ||= {};
    global.propostas ||= [];
    global.historico ||= [];
    global.mandatosPorUsuario ||= {};

    // Migra os registros antigos por grupo para o registro global.
    // Se havia mais de uma eleição antiga aberta, mantém a mais recente;
    // eleições com o mesmo ID têm candidatos e votos consolidados.
    const grupos = Object.values(politica.grupos);
    const eleicoes = grupos.map(g => g?.eleicao).filter(Boolean);
    const abertas = eleicoes.filter(e => e.status === 'aberta').sort((a,b) => Number(b.criadaEm || 0) - Number(a.criadaEm || 0));

    if (!global.eleicao && abertas.length) {
        global.eleicao = JSON.parse(JSON.stringify(abertas[0]));
        mudou = true;
    }

    if (global.eleicao?.status === 'aberta') {
        for (const antiga of abertas) {
            if (!antiga || antiga.id !== global.eleicao.id) continue;
            for (const cargo of ['prefeito','vice','vereador']) {
                global.eleicao.candidatos ||= {};
                const atuais = global.eleicao.candidatos[cargo] ||= [];
                for (const candidato of antiga.candidatos?.[cargo] || []) {
                    if (!atuais.some(x => mesmoUsuario(x.id, candidato.id))) atuais.push(candidato);
                }
                global.eleicao.votos ||= { prefeito:{}, vice:{}, vereador:{} };
                global.eleicao.votos[cargo] ||= {};
                Object.assign(global.eleicao.votos[cargo], antiga.votos?.[cargo] || {});
            }
            mudou = true;
        }
    }

    if (!global.mandato) {
        const mandatos = grupos.map(g => g?.mandato).filter(m => m && Number(m.terminaEm || 0) > Date.now()).sort((a,b) => Number(b.iniciadoEm || 0) - Number(a.iniciadoEm || 0));
        if (mandatos.length) { global.mandato = JSON.parse(JSON.stringify(mandatos[0])); mudou = true; }
    }

    for (const antigo of grupos) {
        if (!antigo || typeof antigo !== 'object') continue;
        for (const [id, partido] of Object.entries(antigo.partidos || {})) {
            if (!global.partidos[id]) { global.partidos[id] = partido; mudou = true; }
            else {
                global.partidos[id].membros ||= [];
                for (const membro of partido?.membros || []) if (!global.partidos[id].membros.some(x => mesmoUsuario(x,membro))) global.partidos[id].membros.push(membro);
            }
        }
        for (const [membro, partidoId] of Object.entries(antigo.membros || {})) {
            if (!global.membros[membro]) { global.membros[membro] = partidoId; mudou = true; }
        }
        for (const proposta of antigo.propostas || []) {
            if (!global.propostas.some(x => String(x.id) === String(proposta.id))) { global.propostas.push(proposta); mudou = true; }
        }
        for (const item of antigo.historico || []) {
            if (!global.historico.some(x => x.eleicaoId && x.eleicaoId === item.eleicaoId && x.iniciadoEm === item.iniciadoEm)) { global.historico.push(item); mudou = true; }
        }
    }

    if (Object.keys(global.mandatosPorUsuario).length === 0) {
        const registros = [...(global.historico || []), global.mandato, ...grupos.flatMap(x => [x?.mandato, ...(x?.historico || [])])].filter(Boolean);
        const vistosMandatos = new Set();
        for (const mandatoAntigo of registros) {
            const chaveMandato = String(mandatoAntigo.eleicaoId || mandatoAntigo.iniciadoEm || `${mandatoAntigo.prefeito?.id || ''}-${mandatoAntigo.terminaEm || ''}`);
            if (vistosMandatos.has(chaveMandato)) continue;
            vistosMandatos.add(chaveMandato);
            const eleitosAntigos = [mandatoAntigo.prefeito, mandatoAntigo.vice, ...(mandatoAntigo.vereadores || [])].filter(x => x?.id);
            for (const eleito of eleitosAntigos) {
                const chave = encontrarChaveUsuario(global.mandatosPorUsuario, eleito.id) || eleito.id;
                global.mandatosPorUsuario[chave] = (Number(global.mandatosPorUsuario[chave]) || 0) + 1;
                mudou = true;
            }
        }
    }

    return mudou;
}

function obterPoliticaGrupo(grupoJid) {
    // Compatibilidade com as chamadas antigas: todos os grupos apontam
    // para o MESMO objeto político persistido em dados-sistemas-v310.json.
    sistemasV310.politica ||= { grupos: {} };
    sistemasV310.politica.grupos ||= {};
    const p = sistemasV310.politica;
    p.global ||= { partidos: {}, membros: {}, eleicao: null, mandato: null, propostas: [], historico: [] };
    const g = p.global;
    g.partidos ||= {}; g.membros ||= {}; g.propostas ||= []; g.historico ||= []; g.mandatosPorUsuario ||= {};
    return g;
}

function cargoPoliticoDoUsuario(grupoJid, usuarioId) {
    if (!grupoJid?.endsWith('@g.us')) return null;
    const g = obterPoliticaGrupo(grupoJid);
    const m = g.mandato;
    if (!m || Date.now() >= Number(m.terminaEm || 0)) {
        if (m) { g.historico.push({ ...m, encerradoEm: Date.now() }); g.mandato = null; }
        return null;
    }
    if (m.prefeito && mesmoUsuario(m.prefeito.id, usuarioId)) return 'prefeito';
    if (m.vice && mesmoUsuario(m.vice.id, usuarioId)) return 'vice';
    if ((m.vereadores || []).some(x => mesmoUsuario(x.id, usuarioId))) return 'vereador';
    return null;
}

function obterContagemMandatosPoliticos(g, usuarioId) {
    const mapa = g.mandatosPorUsuario ||= {};
    const chave = encontrarChaveUsuario(mapa, usuarioId);
    return Math.max(0, Number(chave ? mapa[chave] : 0) || 0);
}

function contarVotosEleicao(eleicao, cargo, candidatoId) {
    return Object.values(eleicao.votos?.[cargo] || {}).filter(id => mesmoUsuario(id, candidatoId)).length;
}

async function gerarImagemRankingPolitico(grupoJid) {
    const g = obterPoliticaGrupo(grupoJid);
    const e = g.eleicao;
    const cargos = [
        ['prefeito', 'PREFEITO'],
        ['vice', 'VICE-PREFEITO'],
        ['vereador', 'VEREADORES']
    ];
    const linhas = [];
    let y = 300;

    if (e) {
        for (const [chave, titulo] of cargos) {
            const lista = [...(e.candidatos?.[chave] || [])]
                .map(c => ({ ...c, votos: contarVotosEleicao(e, chave, c.id) }))
                .sort((a, b) => b.votos - a.votos || Number(a.inscritoEm || 0) - Number(b.inscritoEm || 0));
            linhas.push(`<text x="92" y="${y}" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="21" font-weight="bold" fill="#70E5D6">${titulo}</text>`);
            y += 24;
            if (!lista.length) {
                linhas.push(`<text x="105" y="${y+23}" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="18" fill="#A9C6D8">Nenhum candidato inscrito</text>`);
                y += 55;
                continue;
            }
            for (const [i, c] of lista.slice(0, 5).entries()) {
                const nome = escaparSVG(String(c.nome || 'Participante').slice(0, 28));
                const partido = escaparSVG(String(c.partido || 'Independente').slice(0, 24));
                linhas.push(`<rect x="82" y="${y}" width="860" height="48" rx="12" fill="#152B50" stroke="#2C5278"/>`);
                linhas.push(`<text x="105" y="${y+31}" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="18" font-weight="bold" fill="#F4F8FF">${i+1}. ${nome}</text>`);
                linhas.push(`<text x="620" y="${y+30}" text-anchor="end" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="14" fill="#A9C6D8">${partido}</text>`);
                linhas.push(`<text x="910" y="${y+30}" text-anchor="end" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="17" font-weight="bold" fill="#72E4D1">${c.votos} voto(s)</text>`);
                y += 56;
            }
            y += 10;
        }
    } else {
        linhas.push(`<text x="512" y="360" text-anchor="middle" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="24" fill="#FFFFFF">Nenhuma eleição registrada neste grupo</text>`);
        y = 430;
    }

    const altura = Math.max(520, y + 85);
    const status = e ? `ELEIÇÃO ${e.id} • ${String(e.status || 'sem status').toUpperCase()}` : 'SEM ELEIÇÃO REGISTRADA';
    const svg = `<svg width="1024" height="${altura}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#071629"/><stop offset="100%" stop-color="#103D5B"/></linearGradient></defs>
      <rect width="1024" height="${altura}" fill="url(#bg)"/>
      <rect x="48" y="38" width="928" height="${altura-76}" rx="30" fill="#0A2039" stroke="#2A6680" stroke-width="2"/>
      <text x="92" y="105" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="20" font-weight="bold" letter-spacing="4" fill="#70E5D6">WABOT • POLÍTICA</text>
      <text x="92" y="165" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="42" font-weight="bold" fill="#FFFFFF">RANKING ELEITORAL</text>
      <text x="92" y="207" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="18" fill="#A9C6D8">${escaparSVG(status)} • VOTOS REAIS</text>
      ${linhas.join('\n')}
      <text x="512" y="${altura-52}" text-anchor="middle" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="14" letter-spacing="2" fill="#78A9C0">RESULTADOS ATUALIZADOS NO MOMENTO DA SOLICITAÇÃO</text>
    </svg>`;
    return sharp(Buffer.from(aplicarMolduraNatalSVG(svg))).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

async function finalizarEleicaoPolitica(grupoJid, forcar = false) {
    const g = obterPoliticaGrupo(grupoJid);
    const e = g.eleicao;
    if (!e || e.status !== 'aberta') return 'Não existe eleição aberta neste grupo.';
    if (!forcar && Date.now() < e.terminaEm) return 'A votação ainda está aberta.';
    const totalCandidatos=(e.candidatos.prefeito||[]).length+(e.candidatos.vice||[]).length+(e.candidatos.vereador||[]).length;
    if(!totalCandidatos) { e.status='encerrada'; e.encerradaEm=Date.now(); e.resultado=null; await salvarSistemas310(); return `🗳️ Eleição ${e.id} encerrada sem candidatos. Nenhum mandato foi iniciado. O administrador pode abrir outra eleição.`; }
    const limiteMandatos = 2;
    const elegiveis = cargo => (e.candidatos[cargo] || []).filter(c => obterContagemMandatosPoliticos(g, c.id) < limiteMandatos);
    const ordenar = cargo => elegiveis(cargo).sort((a,b) => contarVotosEleicao(e,cargo,b.id)-contarVotosEleicao(e,cargo,a.id) || a.inscritoEm-b.inscritoEm);
    const vencedor = cargo => ordenar(cargo)[0] || null;
    const vereadores = ordenar('vereador').slice(0,3);
    const agora = Date.now();
    const mandato = { prefeito: vencedor('prefeito'), vice: vencedor('vice'), vereadores, iniciadoEm: agora, terminaEm: agora + 7*24*60*60*1000, eleicaoId: e.id };
    const eleitos = [mandato.prefeito, mandato.vice, ...mandato.vereadores].filter(Boolean).filter((c,i,lista)=>lista.findIndex(x=>mesmoUsuario(x.id,c.id))===i);
    g.mandatosPorUsuario ||= {};
    for (const eleito of eleitos) {
        const chave = encontrarChaveUsuario(g.mandatosPorUsuario, eleito.id) || eleito.id;
        g.mandatosPorUsuario[chave] = (Number(g.mandatosPorUsuario[chave]) || 0) + 1;
    }
    e.mandatosContabilizados = true;
    e.status = 'encerrada'; e.encerradaEm = agora; e.resultado = mandato;
    g.mandato = mandato;
    await salvarSistemas310();
    const bloqueados = Object.values(e.candidatos || {}).flat().filter(c => obterContagemMandatosPoliticos(g,c.id) >= limiteMandatos).length;
    const nome = x => x ? `${x.nome}${x.partido ? ` (${x.partido})` : ''}` : 'Ninguém eleito';
    return `🏛️ *RESULTADO DA ELEIÇÃO ${e.id}*\n\n👑 Prefeito: *${nome(mandato.prefeito)}*\n🤝 Vice-prefeito: *${nome(mandato.vice)}*\n🏛️ Vereadores:\n${vereadores.length ? vereadores.map((x,i)=>`${i+1}. ${nome(x)} — ${contarVotosEleicao(e,'vereador',x.id)} voto(s)`).join('\n') : 'Nenhum eleito'}\n\n📅 Mandato de 7 dias, até ${new Date(mandato.terminaEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}.\n🚫 Candidatos que atingiram o limite de mandatos: ${bloqueados}.`;
}

async function processarEleicao(sock, grupoJid, usuarioId, nome, args, msg) {
    if (!grupoJid?.endsWith('@g.us')) return '🏛️ O sistema político funciona dentro de grupos do WhatsApp.';
    const g = obterPoliticaGrupo(grupoJid);
    const acao = normalizar(args[0] || 'status');
    if (g.eleicao?.status === 'aberta' && Date.now() >= g.eleicao.terminaEm) {
        await finalizarEleicaoPolitica(grupoJid);
    }
    if (acao === 'criar') {
        if (!await remetenteEhAdminBot(sock,msg)) return '⛔ Somente o administrador registrado no código pode criar eleições.';
        if (g.eleicao?.status === 'aberta') return 'Já existe uma eleição aberta neste grupo.';
        if (g.mandato && Date.now() < g.mandato.terminaEm) return `O mandato atual termina em ${new Date(g.mandato.terminaEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}.`;
        const horas = Math.max(1,Math.min(72,Number(args[1])||24));
        const id = `E${Date.now().toString(36).toUpperCase()}`;
        g.eleicao = { id, status:'aberta', criadaEm:Date.now(), terminaEm:Date.now()+horas*3600000, candidatos:{prefeito:[],vice:[],vereador:[]}, votos:{prefeito:{},vice:{},vereador:{}} };
        await salvarSistemas310();
        return `🗳️ *ELEIÇÃO ${id} ABERTA!*\n\nInscrições e votação ficam abertas por ${horas} hora(s). Os eleitos terão mandato de 7 dias.\n\nCandidatar-se: !eleicao candidatar prefeito | vice | vereador\nVotar: !votar prefeito @pessoa\nPartidos: !partido criar NOME`;
    }
    if (acao === 'candidatos') {
        const e=g.eleicao;
        if(!e) return 'Nenhuma eleição registrada.';
        return `🗳️ *CANDIDATOS DA ELEIÇÃO ${e.id}*\n\n${['prefeito','vice','vereador'].map(c=>`*${c.toUpperCase()}*\n${e.candidatos[c].length?e.candidatos[c].map(x=>`• ${x.nome} — ${x.partido||'Independente'}`).join('\n'):'Nenhum candidato'}`).join('\n\n')}`;
    }
    if (acao === 'status') {
        const e = g.eleicao;
        const m = g.mandato && Date.now() < g.mandato.terminaEm ? g.mandato : null;
        if (e?.status === 'aberta' && Date.now() >= e.terminaEm) return await finalizarEleicaoPolitica(grupoJid);
        const linhas = e ? `Eleição: ${e.id} (${e.status})\nCandidatos: prefeito ${e.candidatos.prefeito.length}, vice ${e.candidatos.vice.length}, vereador ${e.candidatos.vereador.length}\n${e.status==='aberta' ? `Encerra: ${new Date(e.terminaEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}` : ''}` : 'Nenhuma eleição registrada.';
        const cargo = m ? `\n\n👑 Prefeito: ${m.prefeito?.nome||'—'}\n🤝 Vice: ${m.vice?.nome||'—'}\n🏛️ Vereadores: ${(m.vereadores||[]).map(x=>x.nome).join(', ')||'—'}\nMandato até: ${new Date(m.terminaEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}` : '\n\nNenhum mandato ativo.';
        return `🏛️ *POLÍTICA DO GRUPO*\n\n${linhas}${cargo}`;
    }
    if (acao === 'candidatar') {
        const e = g.eleicao;
        if (!e || e.status !== 'aberta' || Date.now() >= e.terminaEm) return 'Não há inscrições abertas. Consulte !eleicao status.';
        const cargo = normalizar(args[1]||'');
        if (!['prefeito','vice','vereador'].includes(cargo)) return 'Cargo inválido. Use prefeito, vice ou vereador.';
        const lista = e.candidatos[cargo];
        if (obterContagemMandatosPoliticos(g, usuarioId) >= 2) return '🚫 Você já completou o limite de 2 mandatos eleitos. Não pode concorrer novamente.';
        if (Object.values(e.candidatos).flat().some(x=>mesmoUsuario(x.id,usuarioId))) return 'Você já está inscrito para um cargo nesta eleição. Cada pessoa pode concorrer a apenas um cargo por eleição.';
        if (lista.length >= 30) return 'Limite de 30 candidatos para esse cargo atingido.';
        const partidoId = g.membros[usuarioId];
        const partido = partidoId ? g.partidos[partidoId]?.nome : '';
        lista.push({ id:usuarioId, nome:nomeExibicao(usuarioId,nome), partido:partido||'', inscritoEm:Date.now() });
        await salvarSistemas310();
        return `✅ Candidatura registrada!\nCargo: ${cargo}\nNome: ${nomeExibicao(usuarioId,nome)}\nPartido: ${partido||'Independente'}.`;
    }
    if (acao === 'encerrar') {
        if (!await remetenteEhAdminBot(sock,msg)) return '⛔ Somente o administrador registrado no código pode encerrar a eleição.';
        return await finalizarEleicaoPolitica(grupoJid,true);
    }
    if (acao === 'cancelar') {
        if (!await remetenteEhAdminBot(sock,msg)) return '⛔ Somente o administrador registrado no código pode cancelar a eleição.';
        if (!g.eleicao || g.eleicao.status !== 'aberta') return 'Não existe eleição aberta.';
        g.eleicao.status='cancelada'; g.eleicao.canceladaEm=Date.now(); await salvarSistemas310();
        return '🛑 Eleição cancelada pelo administrador. Nenhum cargo foi alterado.';
    }
    return 'Use !eleicao criar [horas], !eleicao status, !eleicao candidatar prefeito/vice/vereador, !eleicao encerrar ou !eleicao cancelar.';
}

async function processarPartido(grupoJid, usuarioId, nome, args, msg) {
    if (!grupoJid?.endsWith('@g.us')) return 'Partidos só podem ser gerenciados dentro de grupos.';
    const g = obterPoliticaGrupo(grupoJid);
    const acao = normalizar(args[0]||'info');
    const nomePartido = args.slice(1).join(' ').trim();
    const chave = normalizar(nomePartido).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,24);
    if (acao === 'criar') {
        if (!nomePartido || nomePartido.length < 3 || nomePartido.length > 32) return 'Nome do partido deve ter entre 3 e 32 caracteres. Ex.: !partido criar Renovação.';
        if (g.membros[usuarioId]) return 'Você já pertence a um partido. Use !partido sair antes.';
        if (g.partidos[chave]) return 'Já existe um partido com esse nome neste grupo.';
        g.partidos[chave] = { id:chave, nome:nomePartido, lider:usuarioId, membros:[usuarioId], criadoEm:Date.now() };
        g.membros[usuarioId]=chave; await salvarSistemas310();
        return `🏴 *PARTIDO CRIADO*\n${nomePartido}\nVocê é o fundador e líder. Outros podem usar !partido entrar ${nomePartido}.`;
    }
    if (acao === 'entrar') {
        if (!nomePartido) return 'Informe o nome: !partido entrar NOME.';
        if (g.membros[usuarioId]) return 'Você já pertence a um partido. Saia primeiro com !partido sair.';
        const partido=g.partidos[chave]; if(!partido) return 'Partido não encontrado neste grupo.';
        partido.membros ||= []; partido.membros.push(usuarioId); g.membros[usuarioId]=chave; await salvarSistemas310();
        return `Você entrou no partido *${partido.nome}*.`;
    }
    if (acao === 'lider') {
        const atual=g.membros[usuarioId]; const partido=atual?g.partidos[atual]:null;
        if(!partido || !mesmoUsuario(partido.lider,usuarioId)) return 'Somente o líder atual pode transferir a liderança.';
        const alvo=obterMencoes(msg)[0];
        if(!alvo || !partido.membros.some(x=>mesmoUsuario(x,alvo))) return 'Mencione alguém que já pertença ao seu partido: !partido lider @pessoa.';
        partido.lider=alvo; await salvarSistemas310();
        return `👑 Liderança do partido *${partido.nome}* transferida para ${nomeExibicao(alvo)}.`;
    }
    if (acao === 'sair') {
        const atual=g.membros[usuarioId]; if(!atual) return 'Você não está em nenhum partido.';
        const partido=g.partidos[atual]; if(partido?.lider===usuarioId && partido.membros.length>1) return 'Como líder, transfira a liderança antes de sair. (Recurso de transferência disponível ao administrador do grupo.)';
        if(partido) { partido.membros=partido.membros.filter(x=>!mesmoUsuario(x,usuarioId)); if(partido.lider===usuarioId && partido.membros.length===0) delete g.partidos[atual]; }
        delete g.membros[usuarioId]; await salvarSistemas310(); return 'Você saiu do partido.';
    }
    if (acao === 'listar') {
        const lista=Object.values(g.partidos); return lista.length ? `🏴 *PARTIDOS DO GRUPO*\n\n${lista.map(x=>`• *${x.nome}* — ${x.membros.length} membro(s)`).join('\n')}` : 'Ainda não existem partidos neste grupo.';
    }
    const id=g.membros[usuarioId]; const partido=id?g.partidos[id]:null;
    return partido ? `🏴 *${partido.nome}*\nLíder: ${nomeExibicao(partido.lider)}\nMembros: ${partido.membros.length}` : 'Você não está em um partido. Use !partido listar ou !partido criar NOME.';
}

async function processarVotoPolitico(grupoJid, usuarioId, args, msg) {
    if (!grupoJid?.endsWith('@g.us')) return 'A votação política só funciona em grupos.';
    const g=obterPoliticaGrupo(grupoJid), e=g.eleicao;
    if(!e || e.status!=='aberta') return 'Não há votação aberta. Use !eleicao status.';
    if(Date.now()>=e.terminaEm) return await finalizarEleicaoPolitica(grupoJid);
    const cargo=normalizar(args[0]||'');
    if(!['prefeito','vice','vereador'].includes(cargo)) return 'Escolha: !votar prefeito @pessoa, !votar vice @pessoa ou !votar vereador @pessoa.';
    const alvo=obterMencoes(msg)[0]; if(!alvo) return 'Mencione o candidato que receberá seu voto.';
    const candidato=e.candidatos[cargo].find(x=>mesmoUsuario(x.id,alvo)); if(!candidato) return 'Essa pessoa não está inscrita como candidata a esse cargo.';
    e.votos[cargo][usuarioId]=candidato.id; await salvarSistemas310();
    return `🗳️ Voto registrado para *${candidato.nome}* (${cargo}). Você pode alterar seu voto enquanto a eleição estiver aberta.`;
}

async function processarPropostaPolitica(grupoJid, usuarioId, nome, args) {
    if(!grupoJid?.endsWith('@g.us')) return 'Use este comando em um grupo.';
    const g=obterPoliticaGrupo(grupoJid), acao=normalizar(args[0]||'');
    const cargo=cargoPoliticoDoUsuario(grupoJid,usuarioId);
    if(acao==='listar') return g.propostas.length ? `📜 *PROPOSTAS*\n\n${g.propostas.slice(-10).map(p=>`#${p.id} ${p.texto}\n👍 ${Object.values(p.votos).filter(v=>v==='sim').length} | 👎 ${Object.values(p.votos).filter(v=>v==='nao').length}`).join('\n\n')}` : 'Nenhuma proposta registrada.';
    if(acao==='votar') {
        const p=g.propostas.find(x=>x.id===String(args[1]||'')); const voto=normalizar(args[2]||'');
        if(!p) return 'Proposta não encontrada. Use !proposta listar.';
        if(Date.now()>p.terminaEm) return 'A votação dessa proposta terminou.';
        if(!['sim','nao'].includes(voto)) return 'Use !proposta votar ID sim ou !proposta votar ID nao.';
        p.votos[usuarioId]=voto; await salvarSistemas310(); return `Voto ${voto.toUpperCase()} registrado na proposta #${p.id}.`;
    }
    if(cargo!=='vereador') return 'Somente um vereador pode apresentar uma proposta oficial.';
    if(g.propostas.some(p=>mesmoUsuario(p.autor,usuarioId) && Date.now()<p.terminaEm)) return 'Você já possui uma proposta em votação. Aguarde o encerramento antes de publicar outra.';
    const textoProposta=args.join(' ').trim();
    if(textoProposta.length<8 || textoProposta.length>300) return 'Escreva uma proposta de 8 a 300 caracteres: !proposta texto da proposta.';
    const id=String(Date.now()).slice(-6);
    g.propostas.push({id,autor:usuarioId,nome:nomeExibicao(usuarioId,nome),texto:textoProposta,criadaEm:Date.now(),terminaEm:Date.now()+24*3600000,votos:{}});
    await salvarSistemas310();
    return `📜 *PROPOSTA #${id} PUBLICADA*\n${textoProposta}\n\nO grupo pode votar por 24 horas:\n!proposta votar ${id} sim\n!proposta votar ${id} nao`;
}

async function processarPoderPolitico(sock, grupoJid, usuarioId, nome, args, msg) {
    if(!grupoJid?.endsWith('@g.us')) return 'Poderes políticos só funcionam no grupo do mandato.';
    const cargo=cargoPoliticoDoUsuario(grupoJid,usuarioId), g=obterPoliticaGrupo(grupoJid), m=g.mandato;
    const acao=normalizar(args[0]||'');
    if(acao==='decreto') {
        if(cargo!=='prefeito') return 'Somente o prefeito pode publicar decretos.';
        if(Date.now()-(m.ultimoDecreto||0)<24*3600000) return 'O prefeito já publicou um decreto nas últimas 24 horas.';
        const conteudo=args.slice(1).join(' ').trim(); if(conteudo.length<5 || conteudo.length>400) return 'Escreva um decreto de 5 a 400 caracteres: !poderpolitico decreto TEXTO.';
        m.ultimoDecreto=Date.now(); await salvarSistemas310(); return `📜 *DECRETO DA PREFEITURA*\n👑 ${nomeExibicao(usuarioId,nome)}\n\n${conteudo}`;
    }
    if(acao==='proteger') {
        if(cargo!=='vice') return 'Somente o vice-prefeito pode usar Proteção Cívica.';
        const alvo=obterMencoes(msg)[0]; if(!alvo) return 'Mencione quem receberá a proteção: !poderpolitico proteger @pessoa.';
        if(Date.now()-(m.ultimaProtecao||0)<60*60*1000) return 'Proteção Cívica em recarga. O vice pode conceder uma proteção por hora.';
        const jogador=obterJogadorRPG(alvo,nomeExibicao(alvo));
        m.ultimaProtecao=Date.now(); jogador.escudoPoliticoAte=Date.now()+60*60*1000;
        await Promise.all([salvarRPG(),salvarSistemas310()]);
        return `🛡️ Proteção Cívica concedida a ${nomeExibicao(alvo)}. O próximo dano de combate será reduzido por 50%, durante a próxima hora.`;
    }
    if(acao==='status') {
        if(!cargo) return 'Você não ocupa um cargo político ativo neste grupo.';
        const nomes={prefeito:'Decreto diário: !poderpolitico decreto TEXTO',vice:'Proteção Cívica: !poderpolitico proteger @pessoa',vereador:'Apresentar proposta: !proposta TEXTO'};
        return `🏛️ Seu cargo: *${cargo.toUpperCase()}*\nPoder: ${nomes[cargo]}`;
    }
    return 'Use !poderpolitico status, !poderpolitico decreto TEXTO ou !poderpolitico proteger @pessoa.';
}

const MASMORRA_NOME = 'Fenda do Crepúsculo';
const MASMORRA_MAX_ANDAR = 5;

function criarInimigoMasmorra(j, andar) {
    const chefao = andar === MASMORRA_MAX_ANDAR;
    const nomes = ['Sentinela de Cinzas', 'Aranha de Obsidiana', 'Cavaleiro Oco', 'Oráculo Corrompido'];
    const escala = 1 + (j.nivel - 1) * 0.19 + (andar - 1) * 0.32;
    const hpBase = chefao ? 420 : 95 + andar * 34;
    const ataqueBase = chefao ? 17 + andar * 3 : 8 + andar * 2;
    return {
        nome: chefao ? 'Arauto do Crepúsculo' : aleatorio(nomes),
        hp: Math.round(hpBase * escala),
        hpMax: Math.round(hpBase * escala),
        ataque: Math.round(ataqueBase * escala),
        defesa: Math.max(1, Math.round((chefao ? 8 : 2 + andar) * escala * 0.45)),
        chefe: chefao,
        turno: 0
    };
}

function statusMasmorra(j) {
    const m = j.masmorra || {};
    if (!m.ativa) return `🕳️ *${MASMORRA_NOME.toUpperCase()}*\n\nVocê está fora da masmorra.\nMelhor andar: ${m.melhorAndar || 0}/${MASMORRA_MAX_ANDAR}\nVitórias: ${m.vitorias || 0}\nTentativas hoje: ${m.tentativasDia || 0}/${3 + (m.acessosExtras || 0)}\nAcessos extras: ${m.acessosExtras || 0}\n\nUse !masmorra entrar para iniciar uma expedição.`;
    const inimigo = m.inimigo;
    return `🕳️ *${MASMORRA_NOME.toUpperCase()}*\nAndar: ${m.andar}/${MASMORRA_MAX_ANDAR}\n❤️ Sua vida: ${j.hp}/${j.hpMax}\n${inimigo ? `👹 ${inimigo.nome}: ${inimigo.hp}/${inimigo.hpMax} HP\n${inimigo.chefe ? '👑 CHEFE FINAL\n' : ''}` : '✅ Sala limpa. Use !masmorra avancar.'}\n\n!masmorra atacar | curar | avancar | fugir | status`;
}

async function processarMasmorra(id, nome, args) {
    const acao = normalizar(args[0] || 'status');
    const j = obterJogadorRPG(id, nome);
    j.masmorra ||= { melhorAndar: 0, vitorias: 0, tentativasDia: 0, dataTentativas: '' };
    const m = j.masmorra;
    const hoje = dataLocalISO();
    if (m.dataTentativas !== hoje) { m.dataTentativas = hoje; m.tentativasDia = 0; m.acessosExtras = 0; }
    if (m.dataCompras !== hoje) { m.dataCompras = hoje; m.comprasDia = 0; }

    if (acao === 'ajuda' || acao === 'help') {
        return `🕳️ *FENDA DO CREPÚSCULO*\nUma expedição com cinco andares e um chefe final.\n\n!masmorra entrar — iniciar (3 tentativas por dia)\n!masmorra comprar — comprar +3 acessos por 750 WACoins (1 pacote/dia)\n!masmorra status — ver seu progresso\n!masmorra atacar — atacar o inimigo\n!masmorra curar — usar poção\n!masmorra avancar — seguir para a próxima sala\n!masmorra fugir — abandonar a expedição\n\nRecompensas: XP, moedas RPG, Fragmentos Arcanos e Núcleos Abissais.`;
    }
    if (acao === 'status' || acao === 'ver') { await salvarRPG(); return statusMasmorra(j); }

    if (acao === 'comprar' || acao === 'compra') {
        if (m.ativa) return 'Finalize ou abandone sua expedição antes de comprar novos acessos.';
        if (m.comprasDia >= 1) return 'Você já comprou seu pacote extra hoje. A loja de acessos reinicia à meia-noite.';
        const preco = 750;
        const carteira = obterCarteira(id, nome);
        if (carteira.saldo < preco) return `Saldo insuficiente. Você tem ${formatarWACoins(carteira.saldo)} e precisa de ${formatarWACoins(preco)}.`;
        carteira.saldo = Math.round((carteira.saldo - preco) * 100) / 100;
        m.acessosExtras = Math.min(3, (m.acessosExtras || 0) + 3);
        m.comprasDia = 1;
        m.dataCompras = hoje;
        await Promise.all([salvarWACoins(), salvarRPG()]);
        return `🛒 *PACOTE DE ACESSOS COMPRADO!*\n\n+3 entradas na Fenda do Crepúsculo.\nPago: ${formatarWACoins(preco)}\nSaldo: ${formatarWACoins(carteira.saldo)}\nTentativas disponíveis hoje: ${Math.max(0, 3 + m.acessosExtras - m.tentativasDia)}/${3 + m.acessosExtras}\n\nUse !masmorra entrar para começar.`;
    }

    if (acao === 'entrar' || acao === 'iniciar') {
        if (m.ativa) return 'Você já está dentro da Fenda. Use !masmorra status.';
        if (j.inimigo) return 'Encerre seu combate normal antes de entrar na masmorra: !rpg fugir.';
        if (j.hp <= 0) return 'Seu personagem está sem vida. Use !rpg descansar antes de entrar.';
        if (m.tentativasDia >= 3 + (m.acessosExtras || 0)) return `Você esgotou seus acessos de hoje (${3 + (m.acessosExtras || 0)}). Use !masmorra comprar para adquirir mais 3 por 750 WACoins ou volte amanhã.`;
        m.tentativasDia++;
        m.ativa = true; m.andar = 1; m.inimigo = criarInimigoMasmorra(j, 1); m.iniciadaEm = Date.now();
        await salvarRPG();
        return `🕳️ *VOCÊ ENTROU NA FENDA!*\nA passagem se fechou atrás de você. São cinco andares; o último guarda o Arauto do Crepúsculo.\n\n${statusMasmorra(j)}`;
    }
    if (!m.ativa) return 'Você não está em uma expedição. Use !masmorra entrar.';

    if (acao === 'fugir' || acao === 'sair') {
        m.ativa = false; m.inimigo = null; m.andar = 0;
        await salvarRPG();
        return '🏃 Você abandonou a Fenda e voltou ao acampamento. O progresso desta expedição foi encerrado.';
    }
    if (acao === 'avancar' || acao === 'avançar') {
        if (m.inimigo) return 'Derrote o inimigo desta sala antes de avançar.';
        if (m.andar >= MASMORRA_MAX_ANDAR) return 'A Fenda já foi concluída. Use !masmorra status.';
        m.andar++;
        m.inimigo = criarInimigoMasmorra(j, m.andar);
        await salvarRPG();
        return `🚪 *ANDAR ${m.andar}/${MASMORRA_MAX_ANDAR}*\n${m.inimigo.chefe ? '👑 O ARAUTO DO CREPÚSCULO SURGIU!' : `Um ${m.inimigo.nome} bloqueia o caminho.`}\n❤️ Inimigo: ${m.inimigo.hp} HP\nUse !masmorra atacar.`;
    }
    if (acao === 'curar') {
        const itemId = Number(j.inventario.pocao_grande || 0) > 0 ? 'pocao_grande' : 'pocao';
        const item = RPG_ITENS[itemId];
        if (Number(j.inventario[itemId] || 0) <= 0) return 'Você não tem poções. A Fenda não permite usar !rpg descansar durante a expedição.';
        const antes = j.hp;
        j.hp = Math.min(j.hpMax, j.hp + item.cura);
        j.inventario[itemId]--;
        await salvarRPG();
        return `🧪 ${item.nome}: +${j.hp - antes} HP. Vida: ${j.hp}/${j.hpMax}.`;
    }
    if (acao === 'atacar' || acao === 'golpear') {
        if (!m.inimigo) return 'A sala está vazia. Use !masmorra avancar.';
        if (j.hp <= 0) return 'Você está sem vida e não pode atacar.';
        const inimigo = m.inimigo;
        const classeBonus = j.classe === 'guerreiro' ? 1.12 : 1;
        const critico = j.classe === 'ladino' && Math.random() < 0.15;
        const dano = Math.max(1, Math.round((j.ataque + randomInt(0, 8)) * obterMultiplicadorMagiaRPG(j) * classeBonus * (critico ? 1.7 : 1)) - inimigo.defesa);
        inimigo.hp -= dano;
        let resposta = `⚔️ Você causou *${dano}* de dano${critico ? ' (CRÍTICO!)' : ''} em ${inimigo.nome}.`;
        if (inimigo.hp <= 0) {
            const xp = Math.round((inimigo.chefe ? 520 : 75 + m.andar * 28) * (1 + (j.nivel - 1) * 0.06));
            const moedas = inimigo.chefe ? 850 : 65 + m.andar * 35;
            const fragmentos = inimigo.chefe ? 5 : randomInt(1, 3);
            j.moedas += moedas;
            j.inventario.fragmento_arcano += fragmentos;
            if (inimigo.chefe) j.inventario.nucleo_abissal++;
            const subidas = await adicionarXPRPG(j, xp);
            resposta += `\n🏆 *${inimigo.nome} derrotado!*\n✨ +${xp} XP\n🪙 +${moedas} moedas RPG\n🔹 +${fragmentos} Fragmento(s) Arcano(s)${inimigo.chefe ? '\n💠 +1 Núcleo Abissal' : ''}${subidas.length ? `\n⭐ Novo nível: ${subidas.join(', ')}` : ''}`;
            inimigo.hp = 0; m.inimigo = null;
            if (m.andar > (m.melhorAndar || 0)) m.melhorAndar = m.andar;
            if (inimigo.chefe) {
                m.ativa = false; m.andar = 0; m.vitorias++;
                j.hp = Math.min(j.hpMax, j.hp + Math.ceil(j.hpMax * 0.25));
                resposta += `\n\n🌟 *FENDA CONCLUÍDA!*\nVocê recebeu uma restauração de 25% da vida. Use !forjar para transformar seus materiais em equipamentos.`;
            } else {
                resposta += '\n🚪 Use !masmorra avancar para continuar.';
            }
        } else {
            inimigo.turno++;
            let recebido = Math.max(1, inimigo.ataque + randomInt(0, 5) - j.defesa);
            if (j.classe === 'guardiao') recebido = Math.max(1, Math.ceil(recebido * 0.82));
            if (Date.now() < (j.escudoClasseAte || 0)) { recebido = Math.ceil(recebido * 0.35); j.escudoClasseAte = 0; }
            j.hp = Math.max(0, j.hp - recebido);
            resposta += `\n💢 ${inimigo.nome} contra-atacou e causou ${recebido} de dano.\n❤️ Sua vida: ${j.hp}/${j.hpMax}\n👹 Vida do inimigo: ${inimigo.hp}/${inimigo.hpMax}`;
            if (j.hp <= 0) {
                m.ativa = false; m.inimigo = null; m.andar = 0;
                j.hp = Math.max(1, Math.floor(j.hpMax * 0.25));
                resposta += '\n\n💤 Você foi retirado da Fenda e voltou ao acampamento com 25% da vida. Os materiais já conquistados foram mantidos.';
            }
        }
        await salvarRPG();
        return resposta;
    }
    return 'Ação desconhecida. Use !masmorra ajuda.';
}

const RECEITAS_RPG = {
    pocao_grande: { nome: 'Poção grande', materiais: { fragmento_arcano: 3 }, descricao: 'Recupera 100 HP.' },
    espada_runica: { nome: 'Espada rúnica', materiais: { fragmento_arcano: 6, nucleo_abissal: 1 }, descricao: '+20 de ataque quando equipada.' },
    escudo_cristal: { nome: 'Escudo de cristal', materiais: { fragmento_arcano: 6, nucleo_abissal: 1 }, descricao: '+16 de defesa quando equipado.' }
};

async function processarForja(id, nome, args) {
    const j = obterJogadorRPG(id, nome);
    const acao = normalizar(args[0] || 'lista').replace(/\s+/g, '_');
    if (acao === 'lista' || acao === 'ajuda' || acao === 'help') {
        return `⚒️ *FORJA DO AVENTUREIRO*\n\n${Object.entries(RECEITAS_RPG).map(([id, r]) => `• *${id}* — ${r.nome}\n  ${Object.entries(r.materiais).map(([mat, qtd]) => `${qtd}x ${mat === 'fragmento_arcano' ? 'Fragmento Arcano' : 'Núcleo Abissal'}`).join(' + ')}\n  ${r.descricao}`).join('\n\n')}\n\nMateriais: ${j.inventario.fragmento_arcano || 0} Fragmentos Arcanos | ${j.inventario.nucleo_abissal || 0} Núcleos Abissais\n\nCriar: !forjar espada_runica`;
    }
    const receita = RECEITAS_RPG[acao];
    if (!receita) return 'Receita não encontrada. Use !forjar lista.';
    for (const [material, quantidade] of Object.entries(receita.materiais)) {
        if ((Number(j.inventario[material]) || 0) < quantidade) {
            const nomeMaterial = material === 'fragmento_arcano' ? 'Fragmento Arcano' : 'Núcleo Abissal';
            return `Materiais insuficientes: faltam ${Math.max(0, quantidade - (Number(j.inventario[material]) || 0))} ${nomeMaterial}(s). Explore a !masmorra.`;
        }
    }
    for (const [material, quantidade] of Object.entries(receita.materiais)) j.inventario[material] -= quantidade;
    j.inventario[acao] = (Number(j.inventario[acao]) || 0) + 1;
    await salvarRPG();
    return `⚒️ *FORJA CONCLUÍDA!*\nVocê criou: *${receita.nome}*\n${receita.descricao}\n🎒 Quantidade no inventário: ${j.inventario[acao]}\n\n${['espada_runica','escudo_cristal'].includes(acao) ? `Use !rpg equipar ${acao} para equipar.` : 'Use !rpg curar pocao_grande para utilizar.'}`;
}

const RPG_TRABALHOS = {
    agricultor: { nome: 'Agricultor', nivel: 1, minimo: 55, maximo: 90, xp: 18, recurso: 'trigo', qtd: [2, 4] },
    lenhador: { nome: 'Lenhador', nivel: 2, minimo: 70, maximo: 110, xp: 22, recurso: 'madeira', qtd: [2, 4] },
    minerador: { nome: 'Minerador', nivel: 4, minimo: 95, maximo: 145, xp: 28, recurso: 'pedra', qtd: [2, 3] },
    herbalista: { nome: 'Herbalista', nivel: 3, minimo: 80, maximo: 125, xp: 25, recurso: 'ervas', qtd: [2, 4] }
};
const RPG_CULTIVOS = {
    trigo: { nome: 'Trigo', semente: 35, tempo: 60 * 60 * 1000, rendimento: [3, 5], venda: 28, recurso: 'trigo' },
    ervas: { nome: 'Ervas medicinais', semente: 55, tempo: 2 * 60 * 60 * 1000, rendimento: [2, 4], venda: 48, recurso: 'ervas' },
    madeira: { nome: 'Mudas de madeira', semente: 70, tempo: 3 * 60 * 60 * 1000, rendimento: [2, 4], venda: 62, recurso: 'madeira' }
};
const RPG_EDIFICIOS_CIDADE = {
    fazenda: { nome: 'Fazenda comunitária', custo: 1800, recurso: 'madeira', materialQtd: 12, bonus: 'Aumenta em 10% a recompensa de trabalhos de agricultor para membros.' },
    serraria: { nome: 'Serraria', custo: 2200, recurso: 'madeira', materialQtd: 20, bonus: 'Desbloqueia a produção comunitária de madeira.' },
    pedreira: { nome: 'Pedreira', custo: 2600, recurso: 'pedra', materialQtd: 18, bonus: 'Desbloqueia a produção comunitária de pedra.' },
    mercado: { nome: 'Mercado central', custo: 3200, recurso: 'madeira', materialQtd: 25, bonus: 'Aumenta em 5% o valor recebido ao vender colheitas.' },
    muralha: { nome: 'Muralha', custo: 4000, recurso: 'pedra', materialQtd: 35, bonus: 'Aumenta a reputação e a defesa da cidade.' }
};

async function processarEconomiaRPG(id, nome, args, j) {
    const acao = normalizar(args[0] || '');
    const e = j.economia;
    sistemasV310.cidades ||= {};
    sistemasV310.membrosCidade ||= {};
    const chaveCidade = encontrarChaveUsuario(sistemasV310.membrosCidade, id);
    const cidadeId = chaveCidade ? sistemasV310.membrosCidade[chaveCidade] : null;
    const cidade = cidadeId ? sistemasV310.cidades[cidadeId] : null;
    if (cidade) { cidade.membros ||= []; cidade.edificios ||= {}; cidade.estoque ||= { madeira: 0, pedra: 0, trigo: 0, ervas: 0 }; cidade.tesouro = Math.max(0, Number(cidade.tesouro) || 0); }
    const salvarTudo = async () => Promise.all([salvarRPG(), salvarSistemas310()]);

    if (acao === 'fazenda') {
        const sub = normalizar(args[1] || 'status');
        if (sub === 'loja' || sub === 'comprar') {
            if (e.fazendas >= 3) return '🌾 Você já possui o limite de 3 terrenos agrícolas.';
            const custo = 800 + e.fazendas * 650;
            if (j.moedas < custo) return `Você precisa de ${custo} moedas RPG. Saldo: ${j.moedas}.`;
            j.moedas -= custo; e.fazendas++;
            await salvarRPG();
            return `🌱 *NOVO TERRENO ADQUIRIDO!*\nTerrenos: ${e.fazendas}/3\nCusto: ${custo} moedas RPG\n\nPlante com !rpg plantar trigo, ervas ou madeira.`;
        }
        if (sub === 'vender') {
            const recurso = normalizar(args[2] || 'trigo');
            const cultura = RPG_CULTIVOS[recurso];
            const qtd = Math.max(1, Math.floor(Number(args[3]) || 1));
            if (!cultura || e.recursos[cultura.recurso] < qtd) return `Você não possui essa quantidade. Recursos: ${JSON.stringify(e.recursos)}.`;
            let preco = cultura.venda * qtd;
            if (cidade?.edificios?.mercado) preco = Math.floor(preco * 1.05);
            e.recursos[cultura.recurso] -= qtd; j.moedas += preco;
            await salvarRPG();
            return `🧺 Venda concluída: ${qtd} unidade(s) de ${cultura.nome}.\n🪙 +${preco} moedas RPG.`;
        }
        if (sub === 'status' || sub === 'ver') {
            const plantio = e.plantacao ? `${RPG_CULTIVOS[e.plantacao.tipo]?.nome || e.plantacao.tipo}: ${Date.now() >= e.plantacao.colheitaEm ? 'PRONTO PARA COLHER' : `pronto em ${Math.ceil((e.plantacao.colheitaEm-Date.now())/60000)} min`}` : 'Nenhum plantio ativo';
            return `🌾 *SUA FAZENDA*\nTerrenos: ${e.fazendas}/3\nPlantio: ${plantio}\n\nRecursos: trigo ${e.recursos.trigo} | ervas ${e.recursos.ervas} | madeira ${e.recursos.madeira} | pedra ${e.recursos.pedra}\n\n!rpg fazenda comprar\n!rpg plantar TIPO\n!rpg colher\n!rpg fazenda vender TIPO QUANTIDADE`;
        }
        return 'Use !rpg fazenda | !rpg fazenda comprar | !rpg fazenda vender trigo 3.';
    }
    if (acao === 'plantar') {
        const tipo = normalizar(args[1] || ''); const cultura = RPG_CULTIVOS[tipo];
        if (!cultura) return 'Cultivo inválido. Escolha trigo, ervas ou madeira.';
        if (e.fazendas < 1) return 'Você precisa comprar um terreno: !rpg fazenda comprar.';
        if (e.plantacao) return 'Você já tem um plantio ativo. Use !rpg colher quando estiver pronto.';
        if (j.moedas < cultura.semente) return `Sementes custam ${cultura.semente} moedas RPG.`;
        j.moedas -= cultura.semente;
        e.plantacao = { tipo, iniciadoEm: Date.now(), colheitaEm: Date.now() + cultura.tempo };
        await salvarRPG();
        return `🌱 *PLANTIO REALIZADO*\nCultivo: ${cultura.nome}\nCusto das sementes: ${cultura.semente} moedas RPG\nTempo: ${Math.round(cultura.tempo/3600000*10)/10} hora(s)\nUse !rpg colher quando estiver pronto.`;
    }
    if (acao === 'colher') {
        if (!e.plantacao) return 'Você não tem nenhuma plantação ativa.';
        if (Date.now() < e.plantacao.colheitaEm) return `🌿 A plantação ainda está crescendo. Faltam ${Math.ceil((e.plantacao.colheitaEm-Date.now())/60000)} minuto(s).`;
        const tipo = e.plantacao.tipo; const cultura = RPG_CULTIVOS[tipo];
        const qtd = randomInt(cultura.rendimento[0], cultura.rendimento[1] + 1) * Math.max(1, Math.min(3, e.fazendas));
        e.recursos[cultura.recurso] += qtd; e.plantacao = null;
        await salvarRPG();
        return `🌾 *COLHEITA CONCLUÍDA!*\nVocê recebeu ${qtd} unidade(s) de ${cultura.nome}.\nTotal armazenado: ${e.recursos[cultura.recurso]}.\nVenda com !rpg fazenda vender ${tipo} ${qtd}.`;
    }
    if (acao === 'trabalhos' || acao === 'empregos') {
        return `🧰 *CENTRAL DE TRABALHOS*\n\n${Object.entries(RPG_TRABALHOS).map(([key,t])=>`• *${key}* — ${t.nome}\nNível mínimo: ${t.nivel} | Salário: ${t.minimo}–${t.maximo} moedas | +${t.xp} XP`).join('\n\n')}\n\nEscolher: !rpg emprego NOME\nTrabalhar: !rpg trabalhar`;
    }
    if (acao === 'emprego') {
        const tipo = normalizar(args[1] || ''); const trabalho = RPG_TRABALHOS[tipo];
        if (!trabalho) return 'Emprego inválido. Use !rpg trabalhos.';
        if (j.nivel < trabalho.nivel) return `Você precisa estar no nível ${trabalho.nivel} para exercer essa profissão.`;
        e.emprego = tipo; await salvarRPG();
        return `📋 *CONTRATO DE TRABALHO ASSINADO*\nProfissão: ${trabalho.nome}\nSalário por expediente: ${trabalho.minimo}–${trabalho.maximo} moedas RPG\nUse !rpg trabalhar. Há intervalo de 4 horas entre expedientes.`;
    }
    if (acao === 'trabalhar') {
        if (!e.emprego || !RPG_TRABALHOS[e.emprego]) return 'Você ainda não tem profissão. Use !rpg trabalhos e depois !rpg emprego NOME.';
        if (Date.now() < e.trabalhoAte) return `⏳ Você já trabalhou recentemente. Próximo expediente em ${Math.ceil((e.trabalhoAte-Date.now())/60000)} minuto(s).`;
        const t = RPG_TRABALHOS[e.emprego];
        if (j.nivel < t.nivel) return `Seu nível atual não atende ao requisito ${t.nivel}.`;
        const salario = randomInt(t.minimo, t.maximo + 1) + Math.floor(j.nivel * 3);
        const qtd = randomInt(t.qtd[0], t.qtd[1] + 1);
        const bonusCidade = cidade?.edificios?.fazenda && e.emprego === 'agricultor' ? Math.floor(salario * .10) : 0;
        j.moedas += salario + bonusCidade; e.recursos[t.recurso] += qtd; e.trabalhoAte = Date.now() + 4 * 60 * 60 * 1000;
        const subidas = await adicionarXPRPG(j, t.xp);
        await salvarRPG();
        return `🧰 *EXPEDIENTE CONCLUÍDO*\nProfissão: ${t.nome}\nSalário: ${salario + bonusCidade} moedas RPG\nProdução: +${qtd} ${t.recurso}\nExperiência: +${t.xp} XP${subidas.length ? `\nNível alcançado: ${j.nivel}` : ''}\nPróximo expediente em 4 horas.`;
    }
    if (acao === 'cidade') {
        const sub = normalizar(args[1] || 'status');
        if (sub === 'criar') {
            const nomeCidade = args.slice(2).join(' ').trim().replace(/[\n\r]/g, ' ');
            if (cidade) return 'Você já faz parte de uma cidade. Saia dela antes de fundar outra.';
            if (nomeCidade.length < 3 || nomeCidade.length > 26) return 'Nome da cidade: 3 a 26 caracteres. Ex.: !rpg cidade criar Nova Aurora.';
            if (j.moedas < 5000) return `Fundar uma cidade custa 5.000 moedas RPG. Seu saldo: ${j.moedas}.`;
            if (Object.values(sistemasV310.cidades).some(c => normalizar(c.nome) === normalizar(nomeCidade))) return 'Já existe uma cidade com esse nome.';
            const novoId = `C${Date.now().toString(36).toUpperCase()}`;
            j.moedas -= 5000;
            sistemasV310.cidades[novoId] = { id: novoId, nome: nomeCidade, lider: id, membros: [id], tesouro: 0, nivel: 1, reputacao: 0, edificios: {}, estoque: { madeira: 0, pedra: 0, trigo: 0, ervas: 0 }, criadaEm: Date.now() };
            sistemasV310.membrosCidade[id] = novoId;
            await salvarTudo();
            return `🏙️ *CIDADE FUNDADA: ${nomeCidade.toUpperCase()}*\nID: ${novoId}\nFundador: ${nome}\nNível: 1\nTesouro: 0\n\nConvide outros jogadores compartilhando o ID. Eles podem usar !rpg cidade entrar ${novoId}.`;
        }
        if (sub === 'entrar') {
            const alvo = sistemasV310.cidades[String(args[2] || '').toUpperCase()];
            if (!alvo) return 'Cidade não encontrada. Peça o ID ao fundador.';
            if (cidade) return `Você já pertence a ${cidade.nome}.`;
            if (alvo.membros.length >= 30) return 'Essa cidade atingiu o limite de 30 moradores.';
            alvo.membros.push(id); sistemasV310.membrosCidade[id] = alvo.id;
            await salvarSistemas310();
            return `🏡 Você agora é morador(a) de *${alvo.nome}*! Ajude com !rpg cidade ajudar VALOR.`;
        }
        if (sub === 'sair') {
            if (!cidade) return 'Você não pertence a uma cidade.';
            if (mesmoUsuario(cidade.lider,id)) return 'O fundador não pode sair da própria cidade. Transfira a liderança (futura função) ou mantenha a cidade.';
            cidade.membros = cidade.membros.filter(m => !mesmoUsuario(m,id)); delete sistemasV310.membrosCidade[chaveCidade];
            await salvarSistemas310(); return `Você saiu de ${cidade.nome}.`;
        }
        if (sub === 'ajudar' || sub === 'doar') {
            if (!cidade) return 'Você precisa morar em uma cidade para contribuir.';
            const valor = Math.floor(Number(args[2]));
            if (!Number.isInteger(valor) || valor < 1 || j.moedas < valor) return `Informe um valor válido de moedas RPG. Saldo: ${j.moedas}.`;
            j.moedas -= valor; cidade.tesouro += valor; cidade.reputacao += Math.max(1, Math.floor(valor/100));
            await salvarTudo(); return `🤝 Você contribuiu com ${valor} moedas RPG para ${cidade.nome}.\nTesouro: ${cidade.tesouro} | Reputação: ${cidade.reputacao}.`;
        }
        if (sub === 'doar') {
            if (!cidade) return 'Você precisa pertencer a uma cidade.';
            const recurso = normalizar(args[2] || ''); const qtd = Math.floor(Number(args[3]));
            if (!['madeira','pedra','trigo','ervas'].includes(recurso) || !Number.isInteger(qtd) || qtd < 1 || e.recursos[recurso] < qtd) return 'Use !rpg cidade doar madeira|pedra|trigo|ervas QUANTIDADE e tenha os recursos no estoque pessoal.';
            e.recursos[recurso] -= qtd; cidade.estoque[recurso] = (Number(cidade.estoque[recurso]) || 0) + qtd; cidade.reputacao += Math.max(1, Math.floor(qtd/5));
            await salvarTudo(); return `📦 Você doou ${qtd} ${recurso} para ${cidade.nome}. Estoque comunitário: ${cidade.estoque[recurso]}.`;
        }
        if (sub === 'construir') {
            if (!cidade) return 'Você precisa pertencer a uma cidade.';
            if (!mesmoUsuario(cidade.lider,id)) return 'Somente o fundador pode autorizar construções nesta versão.';
            const tipo = normalizar(args[2] || ''); const edificio = RPG_EDIFICIOS_CIDADE[tipo];
            if (!edificio) return `Edifício inválido. Opções: ${Object.keys(RPG_EDIFICIOS_CIDADE).join(', ')}.`;
            if (cidade.edificios[tipo]) return 'Esse edifício já foi construído.';
            if (cidade.tesouro < edificio.custo) return `Tesouro insuficiente. ${edificio.nome} custa ${edificio.custo}; tesouro atual: ${cidade.tesouro}.`;
            if ((Number(cidade.estoque[edificio.recurso]) || 0) < edificio.materialQtd) return `Materiais insuficientes: ${edificio.nome} exige ${edificio.materialQtd} ${edificio.recurso}. Estoque: ${cidade.estoque[edificio.recurso] || 0}. Doe com !rpg cidade doar ${edificio.recurso} QUANTIDADE.`;
            cidade.tesouro -= edificio.custo; cidade.estoque[edificio.recurso] -= edificio.materialQtd; cidade.edificios[tipo] = { nivel: 1, construidaEm: Date.now() }; cidade.nivel += 1;
            await salvarSistemas310(); return `🏗️ *OBRA CONCLUÍDA: ${edificio.nome.toUpperCase()}*\n${edificio.bonus}\nNível da cidade: ${cidade.nivel}\nTesouro restante: ${cidade.tesouro}.`;
        }
        if (sub === 'status' || sub === 'ver' || sub === 'ranking') {
            if (sub === 'ranking') {
                const top = Object.values(sistemasV310.cidades).sort((a,b) => (b.nivel-a.nivel) || (b.reputacao-a.reputacao)).slice(0,10);
                return `🏙️ *CIDADES DO MUNDO*\n\n${top.length ? top.map((c,i)=>`${i+1}. ${c.nome} — nível ${c.nivel}, ${c.membros.length} moradores, reputação ${c.reputacao}`).join('\n') : 'Nenhuma cidade fundada ainda.'}`;
            }
            if (!cidade) return 'Você ainda não pertence a uma cidade. Use !rpg cidade ranking ou !rpg cidade criar NOME.';
            return `🏙️ *${cidade.nome.toUpperCase()}*\nID: ${cidade.id}\nFundador: ${nomeExibicao(cidade.lider)}\nNível: ${cidade.nivel}\nMoradores: ${cidade.membros.length}/30\nTesouro: ${cidade.tesouro} moedas RPG\nReputação: ${cidade.reputacao}\nEdifícios: ${Object.keys(cidade.edificios).map(k=>RPG_EDIFICIOS_CIDADE[k]?.nome || k).join(', ') || 'Nenhum'}\nEstoque: madeira ${cidade.estoque.madeira} | pedra ${cidade.estoque.pedra} | trigo ${cidade.estoque.trigo} | ervas ${cidade.estoque.ervas}\n\n!rpg cidade ajudar VALOR\n!rpg cidade doar RECURSO QTD\n!rpg cidade construir EDIFICIO\n!rpg cidade sair`;
        }
        return '🏙️ !rpg cidade criar NOME | entrar ID | status | ranking | ajudar VALOR | doar RECURSO QTD | construir EDIFICIO | sair';
    }
    return null;
}

// ==================================================
// WABOT POKER — Texas Hold'em simplificado contra o bot
// Sem apostas, sem WACoins e sem dinheiro real: partidas por pontuação.
// ==================================================
const NAIPES_POKER = ['♠', '♥', '♦', '♣'];
const NOMES_MAO_POKER = ['Carta alta', 'Par', 'Dois pares', 'Trinca', 'Sequência', 'Flush', 'Full house', 'Quadra', 'Straight flush'];
function criarBaralhoPoker() {
    const cartas=[];
    for (const naipe of NAIPES_POKER) for (let valor=2; valor<=14; valor++) cartas.push({valor,naipe});
    for (let i=cartas.length-1;i>0;i--) { const j=randomInt(i+1); [cartas[i],cartas[j]]=[cartas[j],cartas[i]]; }
    return cartas;
}
function avaliarMaoPoker(mao) {
    const valores=mao.map(c=>c.valor).sort((a,b)=>b-a);
    const contagem={}; valores.forEach(v=>contagem[v]=(contagem[v]||0)+1);
    const grupos=Object.entries(contagem).map(([v,q])=>({v:Number(v),q})).sort((a,b)=>b.q-a.q||b.v-a.v);
    const flush=mao.every(c=>c.naipe===mao[0].naipe);
    const unicos=[...new Set(valores)].sort((a,b)=>b-a);
    let straight=false, topo=0;
    if(unicos.length===5) {
        if(unicos[0]-unicos[4]===4) { straight=true; topo=unicos[0]; }
        else if(unicos.join(',')==='14,5,4,3,2') { straight=true; topo=5; }
    }
    let categoria=0, desempate=[];
    if(straight&&flush){categoria=8;desempate=[topo];}
    else if(grupos[0].q===4){categoria=7;desempate=[grupos[0].v,grupos[1].v];}
    else if(grupos[0].q===3&&grupos[1].q===2){categoria=6;desempate=[grupos[0].v,grupos[1].v];}
    else if(flush){categoria=5;desempate=valores;}
    else if(straight){categoria=4;desempate=[topo];}
    else if(grupos[0].q===3){categoria=3;desempate=[grupos[0].v,...grupos.slice(1).map(x=>x.v).sort((a,b)=>b-a)];}
    else if(grupos[0].q===2&&grupos[1].q===2){categoria=2;desempate=[Math.max(grupos[0].v,grupos[1].v),Math.min(grupos[0].v,grupos[1].v),grupos[2].v];}
    else if(grupos[0].q===2){categoria=1;desempate=[grupos[0].v,...grupos.slice(1).map(x=>x.v).sort((a,b)=>b-a)];}
    else {categoria=0;desempate=valores;}
    return {categoria,desempate,nome:NOMES_MAO_POKER[categoria]};
}
function compararMaosPoker(a,b) {
    const x=avaliarMaoPoker(a),y=avaliarMaoPoker(b);
    if(x.categoria!==y.categoria)return x.categoria>y.categoria?1:-1;
    for(let i=0;i<Math.max(x.desempate.length,y.desempate.length);i++) if((x.desempate[i]||0)!==(y.desempate[i]||0)) return (x.desempate[i]||0)>(y.desempate[i]||0)?1:-1;
    return 0;
}
function nomeValorPoker(v){return ({11:'J',12:'Q',13:'K',14:'A'})[v]||String(v);}
function cartaTextoPoker(c){return `${nomeValorPoker(c.valor)}${c.naipe}`;}
function decidirTrocaBotPoker(mao,dificuldade){
    const evalMao=avaliarMaoPoker(mao), cont={}; mao.forEach(c=>cont[c.valor]=(cont[c.valor]||0)+1);
    const grupos=Object.entries(cont).map(([v,q])=>({v:Number(v),q})).sort((a,b)=>b.q-a.q||b.v-a.v);
    if(evalMao.categoria>=4) return [];
    if(evalMao.categoria===3) return mao.map((c,i)=>cont[c.valor]===3?-1:i).filter(i=>i>=0);
    if(evalMao.categoria===2) return mao.map((c,i)=>cont[c.valor]===2?-1:i).filter(i=>i>=0);
    if(evalMao.categoria===1) return mao.map((c,i)=>cont[c.valor]===2?-1:i).filter(i=>i>=0);
    const flushSuit=NAIPES_POKER.find(n=>mao.filter(c=>c.naipe===n).length>=4);
    if(flushSuit && dificuldade!=='facil') return mao.map((c,i)=>c.naipe===flushSuit?-1:i).filter(i=>i>=0);
    const vals=[...new Set(mao.map(c=>c.valor))];
    let straightKeep=null;
    for(let start=2;start<=10;start++){
        const seq=[start,start+1,start+2,start+3,start+4];
        const keep=mao.map((c,i)=>seq.includes(c.valor)?i:-1).filter(i=>i>=0);
        if(keep.length>=4 && (!straightKeep||keep.length>straightKeep.length))straightKeep=keep;
    }
    if(dificuldade==='dificil' && !straightKeep){
        const wheel=[14,2,3,4,5], keep=mao.map((c,i)=>wheel.includes(c.valor)?i:-1).filter(i=>i>=0);
        if(keep.length>=4) straightKeep=keep;
    }
    if(straightKeep && dificuldade!=='facil') return mao.map((c,i)=>straightKeep.includes(i)?-1:i).filter(i=>i>=0);
    const maior=grupos[0]?.v||2;
    if(dificuldade==='dificil') {
        const altas=mao.map((c,i)=>({c,i})).filter(x=>x.c.valor>=11).sort((a,b)=>b.c.valor-a.c.valor);
        if(altas.length>=2) { const manter=altas.slice(0,2).map(x=>x.i); return mao.map((c,i)=>manter.includes(i)?-1:i).filter(i=>i>=0); }
    }
    if(dificuldade==='facil'){
        const manter=mao.map((c,i)=>c.valor===maior?i:-1).filter(i=>i>=0);
        const extras=mao.map((c,i)=>i).filter(i=>!manter.includes(i));
        const q=Math.min(extras.length,randomInt(1,4));
        return extras.slice(0,q);
    }
    return mao.map((c,i)=>c.valor===maior?-1:i).filter(i=>i>=0);
}
function escaparSVGPoker(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
async function gerarImagemPoker(partida,revelar=false,resultado=''){
    const W=1100,H=690; let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#101827"/><stop offset="1" stop-color="#263b32"/></linearGradient><linearGradient id="felt" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#176447"/><stop offset="1" stop-color="#0b3b2d"/></linearGradient></defs>
    <rect width="1100" height="690" rx="30" fill="url(#bg)"/><text x="550" y="55" text-anchor="middle" font-family="Arial" font-size="34" font-weight="bold" fill="#f5d58a">WABOT POKER</text>
    <rect x="55" y="85" width="990" height="540" rx="240" fill="#4c3828" stroke="#d2ad67" stroke-width="8"/><rect x="72" y="102" width="956" height="506" rx="230" fill="url(#felt)" stroke="#b98d4e" stroke-width="3"/>
    <text x="550" y="145" text-anchor="middle" font-family="Arial" font-size="23" fill="#e8f4e9">${escaparSVGPoker(partida.botNome||'WABOT')} • ${revelar?avaliarMaoPoker(partida.bot).nome:'MÃO OCULTA'}</text>
    <text x="550" y="565" text-anchor="middle" font-family="Arial" font-size="23" fill="#e8f4e9">${escaparSVGPoker(partida.nome)} • ${avaliarMaoPoker(partida.jogador).nome}</text>`;
    const desenhar=(c,x,y,oculta=false)=>{
      if(oculta){svg+=`<rect x="${x}" y="${y}" width="112" height="158" rx="12" fill="#263c70" stroke="#e4c77f" stroke-width="4"/><rect x="${x+9}" y="${y+9}" width="94" height="140" rx="7" fill="none" stroke="#d8bd7a" stroke-width="2"/><text x="${x+56}" y="${y+94}" text-anchor="middle" font-size="48" fill="#e7d39c">✦</text>`;return;}
      const vermelho=['♥','♦'].includes(c.naipe),cor=vermelho?'#c8323c':'#18202b',v=nomeValorPoker(c.valor);
      svg+=`<rect x="${x}" y="${y}" width="112" height="158" rx="12" fill="#fffdf6" stroke="#d8c9a5" stroke-width="3"/><text x="${x+13}" y="${y+31}" font-family="Arial" font-size="25" font-weight="bold" fill="${cor}">${v}</text><text x="${x+56}" y="${y+93}" text-anchor="middle" font-family="Arial" font-size="48" fill="${cor}">${c.naipe}</text><text x="${x+98}" y="${y+143}" text-anchor="end" font-family="Arial" font-size="22" fill="${cor}">${v}</text>`;
    };
    const x0=550-((5*112+4*12)/2);
    for(let i=0;i<5;i++){desenhar(partida.bot[i],x0+i*124,175,!revelar);desenhar(partida.jogador[i],x0+i*124,365,false);}
    svg+=`<text x="550" y="350" text-anchor="middle" font-family="Arial" font-size="15" fill="#f5d58a">${revelar?escaparSVGPoker(resultado):'TROQUE OU MANTENHA'}</text>
    <text x="550" y="660" text-anchor="middle" font-family="Arial" font-size="16" fill="#cbd5cf">Dificuldade: ${partida.dificuldade.toUpperCase()} • Partida sem apostas ou dinheiro</text></svg>`;
    return sharp(Buffer.from(svg)).png({compressionLevel:9}).toBuffer();
}
async function enviarMesaPoker(sock,jid,partida,revelar=false,resultado=''){
    const imagem=await gerarImagemPoker(partida,revelar,resultado);
    const legenda=revelar
      ? `♠️ *RESULTADO DO WABOT POKER*\n\nVocê: *${avaliarMaoPoker(partida.jogador).nome}*\nWABOT: *${avaliarMaoPoker(partida.bot).nome}*\n\n${resultado}\n\nPlacar da partida: ${partida.placarTexto||'—'}\nNova partida: !poker iniciar [facil|normal|dificil]`
      : `♠️ *WABOT POKER — 5 CARTAS*\n\nSua mão: ${partida.jogador.map((c,i)=>`${i+1}. ${cartaTextoPoker(c)}`).join('  |  ')}\n\nTroque cartas: *!poker trocar 1 3 5*\nOu mantenha: *!poker manter*\nDificuldade: *${partida.dificuldade}*\n\nO bot mantém suas cartas escondidas até o resultado.`;
    await enviar(sock,jid,{image:imagem,caption:legenda});
}
async function concluirPoker(sock,jid,chave,partida,deck){
    const descartar=decidirTrocaBotPoker(partida.bot,partida.dificuldade);
    for(const i of descartar) partida.bot[i]=deck.pop();
    const cmp=compararMaosPoker(partida.jogador,partida.bot);
    const placar=sistemasV310.poker ||= {};
    const reg=placar[partida.id] ||= {nome:partida.nome,vitorias:0,derrotas:0,empates:0,partidas:0};
    reg.nome=partida.nome;reg.partidas++;
    let resultado;
    if(cmp>0){reg.vitorias++;resultado='🏆 Você venceu! Sua mão superou a do WABOT.';}
    else if(cmp<0){reg.derrotas++;resultado='🤖 O WABOT venceu desta vez. Tente novamente!';}
    else{reg.empates++;resultado='🤝 Empate! As mãos têm o mesmo valor.';}
    await salvarSistemas310();
    partida.placarTexto=`${reg.vitorias}V / ${reg.derrotas}D / ${reg.empates}E`;
    partidasPoker.delete(chave);
    await enviarMesaPoker(sock,jid,partida,true,resultado);
}
async function processarPoker(sock,jid,id,nome,args){
    const chave=`${jid}:${id}`,acao=normalizar(args[0]||'ajuda');
    const dificuldades=['facil','normal','dificil'];
    if(acao==='ajuda'||acao==='') return `♠️ *WABOT POKER — COMO JOGAR*\n\nVocê joga uma partida individual contra o WABOT, usando cinco cartas. Cada um recebe uma mão e pode trocar cartas uma vez. A melhor combinação vence.\n\n!poker iniciar [facil|normal|dificil]\n!poker dificuldade facil|normal|dificil\n!poker trocar 1 3 5 — trocar posições\n!poker manter — finalizar sem trocar\n!poker mesa — ver a mesa\n!poker sair — encerrar\n!poker ranking — suas estatísticas\n\nCombinações: carta alta, par, dois pares, trinca, sequência, flush, full house, quadra e straight flush.\nNão existem apostas, perdas de moedas ou dinheiro real.`;
    if(acao==='dificuldade'){
        const d=normalizar(args[1]||''); if(!dificuldades.includes(d)) return 'Escolha: facil, normal ou dificil. Exemplo: !poker dificuldade dificil';
        dificuldadePoker.set(chave,d);return `🎚️ Dificuldade definida: *${d.toUpperCase()}*. Ela será usada na próxima partida.`;
    }
    if(acao==='ranking'){
        const r=sistemasV310.poker?.[id]; if(!r)return 'Você ainda não jogou Poker. Use !poker iniciar.';
        return `♠️ *SEU HISTÓRICO DE POKER*\n\nJogador: ${r.nome||nome}\nPartidas: ${r.partidas||0}\nVitórias: ${r.vitorias||0}\nDerrotas: ${r.derrotas||0}\nEmpates: ${r.empates||0}`;
    }
    const partida=partidasPoker.get(chave);
    if(acao==='sair'||acao==='desistir') {if(!partida)return 'Você não tem uma partida de Poker ativa.';partidasPoker.delete(chave);return '🚪 Partida encerrada. Nenhuma pontuação foi alterada.';}
    if(acao==='iniciar'||acao==='start'){
        if(partida)return 'Você já tem uma partida ativa. Use !poker mesa, !poker trocar ou !poker manter.';
        const d=normalizar(args[1]||dificuldadePoker.get(chave)||'normal');if(!dificuldades.includes(d))return 'Dificuldade inválida. Use facil, normal ou dificil.';
        const deck=criarBaralhoPoker(),jogador=deck.splice(0,5),bot=deck.splice(0,5);
        const nova={id,nome,botNome:'WABOT',dificuldade:d,jogador,bot,deck,criadoEm:Date.now()};partidasPoker.set(chave,nova);
        await enviarMesaPoker(sock,jid,nova,false);return null;
    }
    if(!partida)return 'Nenhuma partida ativa. Comece com !poker iniciar [facil|normal|dificil].';
    if(acao==='mesa'||acao==='status'||acao==='mao'){await enviarMesaPoker(sock,jid,partida,false);return null;}
    if(acao==='manter'||acao==='finalizar'){
        await concluirPoker(sock,jid,chave,partida,partida.deck);return null;
    }
    if(acao==='trocar'){
        if(partida.trocou)return 'Você já trocou cartas nesta rodada. Use !poker manter para revelar o resultado.';
        const indices=[...new Set(args.slice(1).map(x=>Number(x)-1))];
        if(!indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>4))return 'Informe posições de 1 a 5. Exemplo: !poker trocar 1 3 5';
        for(const i of indices)partida.jogador[i]=partida.deck.pop();
        partida.trocou=true;await concluirPoker(sock,jid,chave,partida,partida.deck);return null;
    }
    return 'Comando inválido. Use !poker ajuda.';
}

async function processarRPG(id, nome, args, grupoJid = '') {
    const acao = normalizar(args[0] || 'status');
    const j = obterJogadorRPG(id, nome);
    let msg = '';
    if (j.masmorra?.ativa && !['status', 'perfil', 'magias', 'poderes', 'magia'].includes(acao)) {
        return '🕳️ Você está dentro da Fenda do Crepúsculo. Para evitar combates simultâneos, use !masmorra atacar/curar/avancar/fugir até concluir a expedição.';
    }
    const economiaResposta = await processarEconomiaRPG(id, nome, args, j);
    if (economiaResposta !== null) return economiaResposta;

    if (acao === 'classe') {
        const escolhida=normalizar(args[1]||'').replace(/\s+/g,'');
        if(!args[1]) return `🧬 *CLASSES RPG*\n\n${Object.entries(RPG_CLASSES).map(([id,c])=>`• *${id}* — ${c.nome}\nPassiva: ${c.passiva}\nHabilidade: ${c.habilidade}`).join('\n\n')}\n\nEscolher: !rpg classe guerreiro/mago/guardiao/ladino. A primeira escolha é grátis; trocar custa 250 moedas RPG.`;
        if(!RPG_CLASSES[escolhida]) return 'Classe inválida. Use !rpg classe para ver as opções.';
        if(j.classe===escolhida) return `Você já é ${RPG_CLASSES[escolhida].nome}.`;
        if(j.classe && j.moedas<250) return 'Trocar de classe custa 250 moedas RPG.';
        if(j.classe) j.moedas-=250;
        j.classe=escolhida; await salvarRPG();
        return `🧬 *CLASSE DEFINIDA: ${RPG_CLASSES[escolhida].nome.toUpperCase()}*\nPassiva: ${RPG_CLASSES[escolhida].passiva}\nHabilidade: ${RPG_CLASSES[escolhida].habilidade}${j.moedas<250?'':'\nTroca de classe: 250 moedas RPG.'}`;
    }
    if (acao === 'habilidade') {
        if(!j.classe) return 'Escolha uma classe primeiro: !rpg classe.';
        if(!j.inimigo) return 'Você precisa estar em combate para usar sua habilidade. Use !rpg explorar.';
        if(Date.now()<(j.habilidadeCooldownAte||0)) return `Habilidade em recarga. Aguarde ${Math.ceil((j.habilidadeCooldownAte-Date.now())/1000)} segundo(s).`;
        const agora=Date.now(); j.habilidadeCooldownAte=agora+90000;
        let descricao='';
        if(j.classe==='guerreiro') { j.bonusProximoAtaque=1.75; j.bonusProximoAtaqueAte=agora+60000; descricao='⚔️ Fúria ativada: seu próximo ataque causa 75% de dano adicional.'; }
        else if(j.classe==='mago') { j.bonusProximaMagia=1.5; j.bonusProximaMagiaAte=agora+60000; descricao='✨ Sobrecarga ativada: sua próxima magia recebe 50% de poder adicional.'; }
        else if(j.classe==='guardiao') { j.escudoClasseAte=agora+60000; descricao='🛡️ Barreira ativada: o próximo dano recebido será reduzido em 65%.'; }
        else if(j.classe==='ladino') { j.criticoGarantidoAte=agora+60000; descricao='🗡️ Emboscada preparada: seu próximo ataque será crítico.'; }
        await salvarRPG(); return `${descricao}\n⏳ Recarga: 90 segundos.`;
    }
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
        if (encontro <= 70) {
            const base = aleatorio(RPG_INIMIGOS);
            const escala = 1 + (j.nivel - 1) * 0.15;
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
        } else if (encontro <= 93) {
            const moedas = randomInt(55, 151) + j.nivel * 5;
            const xp = randomInt(35, 91) + j.nivel * 3;
            j.moedas += moedas;
            const subidas = await adicionarXPRPG(j, xp);
            msg = `🎒 Você encontrou um baú abandonado!\n🪙 +${moedas} moedas RPG\n✨ +${xp} XP${subidas.length ? '\n⭐ Subiu para o nível ' + subidas.join(', ') + '!' : ''}`;
        } else {
            const cura = Math.min(j.hpMax - j.hp, 40);
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
        const cargo = cargoPoliticoDoUsuario(grupoJid,id);
        const bonusCargo = cargo==='prefeito' ? 1.10 : cargo==='vice' ? 1.06 : cargo==='vereador' ? 1.03 : 1;
        const bonusClasse = j.classe==='guerreiro' ? 1.12 : 1;
        const bonusHabilidade = Date.now()<(j.bonusProximoAtaqueAte||0) ? (Number(j.bonusProximoAtaque)||1) : 1;
        const critico = Date.now()<(j.criticoGarantidoAte||0) || (j.classe==='ladino' && Math.random()<0.15);
        const dano = Math.max(1, Math.round((j.ataque + randomInt(0, 7) + bonusCopia) * multiplicador * bonusCargo * bonusClasse * bonusHabilidade * (critico?1.7:1)) - j.inimigo.defesa);
        j.bonusProximoAtaque=1; j.bonusProximoAtaqueAte=0; j.criticoGarantidoAte=0;
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
            let recebido = Math.max(1, j.inimigo.ataque + randomInt(0, 4) - Math.round(j.defesa * (j.classe==='guardiao'?1.15:1)));
            const reducaoCargo = cargo==='prefeito'?0.05:cargo==='vice'?0.10:cargo==='vereador'?0.03:0;
            if (reducaoCargo) recebido=Math.ceil(recebido*(1-reducaoCargo));
            if (Date.now()<(j.escudoClasseAte||0)) { recebido=Math.ceil(recebido*0.35); j.escudoClasseAte=0; }
            if (Date.now()<(j.escudoPoliticoAte||0)) { recebido=Math.ceil(recebido*0.5); j.escudoPoliticoAte=0; }
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
            j.missao = { tipo: 'explorar', meta: 3, progresso: 0, recompensa: 120, xp: 90 };
            await salvarRPG();
            return `🏅 Missão concluída!\n🪙 +120 moedas RPG\n✨ +90 XP${subidas.length ? '\n⭐ Nível: ' + j.nivel : ''}\nNova missão: explore 3 vezes.`;
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
async function processarGuilda(id,nome,args,msg) {
    const acao=normalizar(args[0]||'status'); const nomeGuilda=args.slice(1).join(' ').trim();
    const chaveMembro=encontrarChaveUsuario(sistemasV310.membrosGuilda,id);
    const gid=chaveMembro?sistemasV310.membrosGuilda[chaveMembro]:null; const guilda=gid?sistemasV310.guildas[gid]:null;
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
        g.convites ||= {};
        const conviteKey=encontrarChaveUsuario(g.convites,id);
        if (!conviteKey || Date.now()-Number(g.convites[conviteKey])>7*86400000) return 'Você precisa receber um convite válido do líder. Convites expiram em 7 dias.';
        delete g.convites[conviteKey];
        g.membros ||= [];
        if (!g.membros.some(x=>mesmoUsuario(x,id))) g.membros.push(id);
        sistemasV310.membrosGuilda[id]=g.id; await salvarSistemas310();
        return `Bem-vindo à guilda *${g.nome}*! Convite confirmado.`;
    }
    if (acao==='convidar') {
        if (!guilda || !mesmoUsuario(guilda.lider,id)) return 'Somente o líder pode convidar membros.';
        const alvo=mencionarAlvo(msg,args,1); const alvoFinal=alvo || (String(args[1]||'').replace(/\D/g,'')?`${String(args[1]).replace(/\D/g,'')}@s.whatsapp.net`:'');
        if (!alvoFinal || mesmoUsuario(alvoFinal,id) || encontrarChaveUsuario(sistemasV310.membrosGuilda,alvoFinal)) return 'Informe alguém que ainda não esteja em uma guilda: !guilda convidar @pessoa.';
        guilda.convites ||= {}; guilda.convites[alvoFinal]=Date.now(); await salvarSistemas310();
        return `📨 Convite enviado para ${nomeExibicao(alvoFinal)}. A pessoa deve usar *!guilda entrar ${guilda.id}* em até 7 dias.`;
    }
    if (acao==='sair') {
        if (!guilda) return 'Você não está em uma guilda.';
        if (mesmoUsuario(guilda.lider,id) && guilda.membros.length>1) return 'O líder precisa transferir a liderança antes de sair.';
        guilda.membros=guilda.membros.filter(x=>!mesmoUsuario(x,id)); delete sistemasV310.membrosGuilda[chaveMembro];
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
    if (acao==='status' || acao==='ver') return guilda?`🏰 *${guilda.nome}*\nID: ${guilda.id}\nLíder: ${nomeExibicao(guilda.lider)}\nMembros: ${guilda.membros.length}\nConvites pendentes: ${Object.keys(guilda.convites||{}).length}\nTesouro: ${formatarWACoins(guilda.tesouro)}\n\n!guilda convidar @pessoa | !guilda doar valor | !guilda sair`:'Você não está em uma guilda. Use !guildas ou !guilda criar nome.';
    return 'Comandos: !guilda criar nome | !guilda convidar @pessoa | !guilda entrar ID | !guilda sair | !guilda doar valor | !guilda.';
}

async function processarTripulacao(id,nome,args,msg) {
    const acao=normalizar(args[0]||'status');
    sistemasV310.tripulacoes ||= {}; sistemasV310.membrosTripulacao ||= {};
    const chaveMembro=encontrarChaveUsuario(sistemasV310.membrosTripulacao,id);
    const tripId=chaveMembro?sistemasV310.membrosTripulacao[chaveMembro]:null;
    const trip=tripId?sistemasV310.tripulacoes[tripId]:null;
    if (acao==='criar') {
        const titulo=args.slice(1).join(' ').trim();
        if (trip) return 'Você já pertence a uma tripulação.';
        if (titulo.length<3||titulo.length>28) return 'Use !tripulacao criar NOME (3 a 28 caracteres).';
        const novoId=`T${Date.now().toString(36).toUpperCase()}`;
        sistemasV310.tripulacoes[novoId]={id:novoId,nome:titulo,lider:id,membros:[id],convites:{},pontos:0,capturas:0,criadaEm:Date.now()};
        sistemasV310.membrosTripulacao[id]=novoId; await salvarSistemas310();
        return `🚢 *TRIPULAÇÃO ${titulo} CRIADA!*\nID: ${novoId}\nConvide até 7 pessoas com !tripulacao convidar @pessoa.`;
    }
    if (acao==='entrar' || acao==='aceitar') {
        const alvoTrip=sistemasV310.tripulacoes[String(args[1]||'').toUpperCase()];
        if (!alvoTrip) return 'Tripulação não encontrada. Use !tripulacao ranking.';
        if (trip) return 'Você já pertence a uma tripulação. Saia antes de entrar em outra.';
        const convite=encontrarChaveUsuario(alvoTrip.convites||{},id);
        if (!convite || Date.now()-Number(alvoTrip.convites[convite])>7*86400000) return 'Você precisa de um convite válido do capitão. Convites expiram em 7 dias.';
        delete alvoTrip.convites[convite];
        if (alvoTrip.membros.length>=8) return 'Essa tripulação já atingiu o limite de 8 integrantes.';
        if (!alvoTrip.membros.some(x=>mesmoUsuario(x,id))) alvoTrip.membros.push(id);
        sistemasV310.membrosTripulacao[id]=alvoTrip.id; await salvarSistemas310();
        return `⚓ Você entrou na tripulação *${alvoTrip.nome}*!`;
    }
    if (acao==='convidar') {
        if (!trip || !mesmoUsuario(trip.lider,id)) return 'Somente o capitão pode convidar integrantes.';
        const alvo=mencionarAlvo(msg,args,1); const alvoFinal=alvo || (String(args[1]||'').replace(/\D/g,'')?`${String(args[1]).replace(/\D/g,'')}@s.whatsapp.net`:'');
        if (!alvoFinal || mesmoUsuario(alvoFinal,id) || encontrarChaveUsuario(sistemasV310.membrosTripulacao,alvoFinal)) return 'Mencione alguém que ainda não esteja em uma tripulação.';
        if (trip.membros.length>=8) return 'Tripulação cheia: limite de 8 integrantes.';
        trip.convites ||= {}; trip.convites[alvoFinal]=Date.now(); await salvarSistemas310();
        return `📨 Convite enviado para ${nomeExibicao(alvoFinal)}. Use !tripulacao entrar ${trip.id} em até 7 dias.`;
    }
    if (acao==='transferir' || acao==='lider') {
        if (!trip || !mesmoUsuario(trip.lider,id)) return 'Somente o capitão atual pode transferir a liderança.';
        const alvo=mencionarAlvo(msg,args,1);
        if (!alvo || !trip.membros.some(x=>mesmoUsuario(x,alvo))) return 'Mencione alguém que já esteja na tripulação: !tripulacao transferir @pessoa.';
        trip.lider=trip.membros.find(x=>mesmoUsuario(x,alvo)) || alvo;
        await salvarSistemas310();
        return `👑 Liderança da tripulação *${trip.nome}* transferida para ${nomeExibicao(trip.lider)}.`;
    }
    if (acao==='sair') {
        if (!trip) return 'Você não está em uma tripulação.';
        if (mesmoUsuario(trip.lider,id) && trip.membros.length>1) return 'O capitão deve transferir a liderança antes de sair.';
        trip.membros=trip.membros.filter(x=>!mesmoUsuario(x,id)); delete sistemasV310.membrosTripulacao[chaveMembro];
        if (!trip.membros.length) delete sistemasV310.tripulacoes[trip.id];
        await salvarSistemas310(); return 'Você saiu da tripulação.';
    }
    if (acao==='ranking') {
        const lista=Object.values(sistemasV310.tripulacoes).sort((a,b)=>(b.pontos||0)-(a.pontos||0)).slice(0,10);
        return `🚢 *RANKING DE TRIPULAÇÕES*\n\n${lista.length?lista.map((t,i)=>`${i+1}. *${t.nome}* — ${Number(t.pontos||0).toLocaleString('pt-BR')} pontos | ${t.membros.length}/8 membros`).join('\n'):'Nenhuma tripulação criada.'}`;
    }
    if (acao==='status' || acao==='ver') return trip?`🚢 *${trip.nome}*\nID: ${trip.id}\nCapitão: ${nomeExibicao(trip.lider)}\nIntegrantes: ${trip.membros.map(x=>nomeExibicao(x)).join(', ')}\n🐟 Capturas da tripulação: ${trip.capturas||0}\n🏆 Pontos: ${(trip.pontos||0).toLocaleString('pt-BR')}\nConvites pendentes: ${Object.keys(trip.convites||{}).length}`:'Você não pertence a uma tripulação. Use !tripulacao criar NOME.';
    return '🚢 *TRIPULAÇÕES*\n!tripulacao criar NOME\n!tripulacao convidar @pessoa\n!tripulacao entrar ID\n!tripulacao status\n!tripulacao ranking\n!tripulacao transferir @pessoa\n!tripulacao sair\n\nCada tripulação aceita até 8 integrantes. Capturas de pesca aumentam a pontuação coletiva.';
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
    r[flag]=true; const premio=diaria?450:2200; await adicionarWACoins(id,nome,premio); await salvarSistemas310();
    return `🏅 Missões ${tipo==='diaria'?'diárias':'semanais'} concluídas! Você recebeu ${formatarWACoins(premio)}.`;
}
async function processarChefe(sock,jid,id,nome,args) {
    const acao=normalizar(args[0]||'status'); let chefe=sistemasV310.chefes[jid];
    if (acao==='iniciar') {
        if (chefe && chefe.hp>0) return 'Já existe um Chefe Mundial ativo nesta conversa.';
        const modelos = [
            { nome:'Colosso das Cinzas', hp:100000, ataque:28, defesa:8, recompensa:1 },
            { nome:'Dragão do Vazio', hp:150000, ataque:38, defesa:12, recompensa:1.35 },
            { nome:'Titã Abissal', hp:250000, ataque:50, defesa:16, recompensa:1.8 }
        ];
        const pedido=normalizar(args[1]||'');
        const indice=pedido==='2'||pedido==='medio'||pedido==='150k'?1:pedido==='3'||pedido==='dificil'||pedido==='250k'?2:0;
        const modelo=modelos[indice];
        chefe={...modelo,hpMax:modelo.hp,iniciadoEm:Date.now(),contribuicoes:{},ultimaAcao:0,fase:1,derrotadoEm:0};
        sistemasV310.chefes[jid]=chefe; await salvarSistemas310();
        return `🌋 *CHEFE MUNDIAL: ${chefe.nome.toUpperCase()}*
❤️ ${chefe.hp.toLocaleString('pt-BR')}/${chefe.hpMax.toLocaleString('pt-BR')} HP
⚔️ Ataque: ${chefe.ataque} | Defesa: ${chefe.defesa}

Todos podem participar com !chefemundial atacar ou !chefemundial conjurar NOME.
Dificuldades: !chefemundial iniciar 1 (100 mil HP), 2 (150 mil HP) ou 3 (250 mil HP).`;
    }
    if (!chefe || chefe.hp<=0) return 'Não há Chefe Mundial ativo. Inicie com !chefemundial iniciar [1|2|3].';
    if (acao==='status') {
        const fase=chefe.hp<=chefe.hpMax*.15?3:chefe.hp<=chefe.hpMax*.4?2:1;
        return `🌋 *${chefe.nome}*
❤️ HP: ${chefe.hp.toLocaleString('pt-BR')}/${chefe.hpMax.toLocaleString('pt-BR')}
🔥 Fase: ${fase}/3
⚔️ Participantes: ${Object.keys(chefe.contribuicoes).length}
🏆 Maior dano:
${Object.entries(chefe.contribuicoes).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([u,d],i)=>`${i+1}. ${nomeExibicao(u)} — ${d.toLocaleString('pt-BR')}`).join('\n')||'Ainda ninguém.'}`;
    }
    if (acao==='atacar' || acao==='conjurar') {
        const j=obterJogadorRPG(id,nome); if (j.hp<=0) return 'Seu personagem está sem vida. Use !rpg descansar.';
        let dano=Math.max(1,Math.round(j.ataque*2.5+randomInt(0,25)+j.nivel*2-chefe.defesa*.25)); let extra='';
        if (acao==='conjurar') {
            const chave=normalizar(args.slice(1).join('_')).replace(/\s+/g,'_'); const magia=RPG_MAGIAS[chave];
            if (!magia || !j.magias.includes(chave)) return 'Magia inválida ou não desbloqueada. Use !rpg magias.';
            if (chave==='agua') { const cura=Math.min(40,j.hpMax-j.hp); j.hp+=cura; dano=Math.max(1,Math.floor(dano*.5)); extra=`\n💧 Recuperou ${cura} HP.`; }
            else if (chave==='plantificar') dano=Math.round(dano*1.6);
            else if (chave==='bola_de_fogo') dano=Math.round((j.ataque*4.5+75+j.nivel*3)*obterMultiplicadorMagiaRPG(j));
            else dano=Math.round(dano*1.4);
            registrarProgressoMissoes(id,'conjurar',1);
        }
        const faseAntes=chefe.hp<=chefe.hpMax*.15?3:chefe.hp<=chefe.hpMax*.4?2:1;
        dano=Math.max(1,dano); chefe.hp=Math.max(0,chefe.hp-dano); chefe.contribuicoes[id]=(chefe.contribuicoes[id]||0)+dano;
        const faseDepois=chefe.hp<=chefe.hpMax*.15?3:chefe.hp<=chefe.hpMax*.4?2:1;
        const avisoFase=faseDepois>faseAntes?`\n🔥 *${faseDepois===2?'FASE 2: FÚRIA ABISSAL!':'FASE 3: DESESPERO FINAL!'}* O chefe ficou mais perigoso.`:'';
        let danoRecebido=0;
        if (chefe.hp>0) {
            const multiplicadorFase=faseDepois===3?1.65:faseDepois===2?1.3:1;
            const defesaEfetiva=j.defesa*(j.classe==='guardiao'?1.15:1);
            danoRecebido=Math.max(1,Math.round(chefe.ataque*multiplicadorFase-defesaEfetiva));
            j.hp=Math.max(0,j.hp-danoRecebido);
            if (j.hp<=0) j.hp=Math.max(1,Math.floor(j.hpMax*.35));
        }
        let resultado=`⚔️ ${nome} causou ${dano.toLocaleString('pt-BR')} de dano a ${chefe.nome}.${extra}\n❤️ Chefe: ${chefe.hp.toLocaleString('pt-BR')}/${chefe.hpMax.toLocaleString('pt-BR')} HP${avisoFase}${danoRecebido?`\n💥 Contra-ataque do chefe: -${danoRecebido} HP (sua vida: ${j.hp}/${j.hpMax}).`:''}`;
        if (chefe.hp===0 && !chefe.recompensasEntregues) {
            const ranking=Object.entries(chefe.contribuicoes).sort((a,b)=>b[1]-a[1]);
            const fator=Number(chefe.recompensa)||1;
            for (const [uid,danoTotal] of ranking) {
                const premioW=Math.round((1800+Math.min(18000,Math.floor(danoTotal*.16)))*fator);
                const premioR=Math.round((2600+Math.min(26000,Math.floor(danoTotal*.2)))*fator);
                await adicionarWACoins(uid,nomeExibicao(uid),premioW);
                const j2=obterJogadorRPG(uid,nomeExibicao(uid));
                j2.moedas+=premioR;
                const xp=Math.round((2200+Math.min(30000,Math.floor(danoTotal*.12)))*fator);
                const subidas=await adicionarXPRPG(j2,xp);
                if (randomInt(1,101)<=12) j2.inventario.pocao_grande=(Number(j2.inventario.pocao_grande)||0)+1;
                if (randomInt(1,101)<=3) j2.inventario.liberador=(Number(j2.inventario.liberador)||0)+1;
                if (subidas.length) j2.ultimaRecompensaBossNiveis=subidas;
            }
            const bonusColocacao=[8000,5000,2500];
            for (let i=0;i<Math.min(3,ranking.length);i++) {
                const uid=ranking[i][0]; const j2=obterJogadorRPG(uid,nomeExibicao(uid)); j2.moedas+=bonusColocacao[i];
                await adicionarWACoins(uid,nomeExibicao(uid),bonusColocacao[i]);
            }
            resultado+=`\n\n🏆 *CHEFE DERROTADO!*\n${ranking.slice(0,8).map(([u,d],i)=>`${i+1}. ${nomeExibicao(u)} — ${d.toLocaleString('pt-BR')} dano`).join('\n')}\n\n🎁 Recompensas por participação: WACoins, moedas RPG e XP proporcionais ao dano.\n🥇 Bônus de colocação: 8.000 / 5.000 / 2.500 moedas RPG e WACoins.\n🧪 Chance de poção grande: 12% | Liberador: 3%.`;
            chefe.derrotadoEm=Date.now(); chefe.hp=0; chefe.recompensasEntregues=true;
        }
        await Promise.all([salvarSistemas310(),salvarRPG(),salvarWACoins()]); return resultado;
    }
    return 'Use !chefemundial iniciar [1|2|3] | status | atacar | conjurar NOME.';
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
    if (mensagemTemPrefixo(conteudo)) {
        const comandoManutencao = interpretarComando(conteudo).comando;
        if (comandoManutencao === '!manutencao') {
            if (!await remetenteEhAdminBot(sock, msg)) {
                await texto(sock, jid, '⛔ Apenas os administradores configurados no código podem ativar ou encerrar a manutenção.');
                return;
            }
            const acao = interpretarComando(conteudo).args[0]?.toLowerCase();
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

    if (manutencaoAtiva && mensagemTemPrefixo(conteudo) && !await remetenteEhAdminBot(sock, msg)) {
        await enviarAvisoManutencao(sock, jid, '🛠️ O WABOT está em manutenção. Tente novamente mais tarde.');
        return;
    }

    // Com o bot desligado, mensagens comuns não avançam entrevistas nem executam ações.
    if (!botAtivo && !mensagemTemPrefixo(conteudo)) return;

    // Respostas livres dentro de uma sala de entrevista são processadas antes dos comandos.
    if (jid.endsWith('@g.us') && entrevistasAtivas.has(jid) && !mensagemTemPrefixo(conteudo)) {
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

    if (!mensagemTemPrefixo(conteudo)) return;

    const interpretado = interpretarComando(conteudo);
    const comando = interpretado.comando;
    const args = interpretado.args;

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

    console.log(`[WABOT] ${comando}${interpretado.corrigido ? ` (corrigido de ${interpretado.original})` : ''} - ${nomeResolvido}`);

    switch (comando) {

        case '!erros': {
            if (!await remetenteEhAdminBot(sock, msg)) { resposta = '⛔ Apenas administradores configurados podem consultar os erros internos.'; break; }
            const limite = Math.min(10, Math.max(1, Number(args[0]) || 10));
            const recentes = historicoErrosBot.slice(-limite).reverse();
            resposta = recentes.length
                ? `🧰 *DIAGNÓSTICO DO WABOT — ${recentes.length} ERRO(S)*\n\n${recentes.map(e => `#${e.numero} • Código ${e.codigo} — ${CATALOGO_ERROS_WABOT[e.codigo]?.titulo || 'ERRO'}\n${new Date(e.horario).toLocaleString('pt-BR')}\n${e.erro.slice(0, 500)}`).join('\n\n')}\n\nUse !codigo NÚMERO para detalhes ou !codigos para ver o catálogo.`
                : '✅ Nenhum erro registrado desde a última inicialização do bot. Use !codigos para consultar o catálogo.';
            break;
        }

        case '!codigos': {
            const linhas = Object.entries(CATALOGO_ERROS_WABOT).map(([codigo, item]) => `*${codigo} — ${item.titulo}*\n${item.descricao}`).join('\n\n');
            resposta = `🧰 *CATÁLOGO DE ERROS — WABOT V${VERSAO}*\n\n${linhas}\n\nUse *!codigo 202* para consultar os detalhes de um código.\n_Nota: o catálogo descreve categorias possíveis; não significa que todos esses erros já ocorreram._`;
            break;
        }

        case '!codigo': {
            const numeroCodigo = String(args[0] || '').trim();
            const item = CATALOGO_ERROS_WABOT[numeroCodigo];
            if (!item) {
                resposta = 'Código inválido ou inexistente. Use !codigos para ver a lista.';
                break;
            }
            const ocorrencias = historicoErrosBot.filter(e => e.codigo === Number(numeroCodigo)).length;
            resposta = `🧾 *CÓDIGO ${numeroCodigo} — ${item.titulo}*\n\n*Descrição:* ${item.descricao}\n*Possíveis causas:* ${item.causa}\n*Ação recomendada:* ${item.acao}\n\n*Ocorrências nesta sessão:* ${ocorrencias}`;
            break;
        }

        case '!buscarcodigo': {
            const codigo = String(args[0] || '').toUpperCase().trim();
            if (!/^WB-\d{8}-[A-Z0-9]{5}$/.test(codigo)) { resposta = 'Formato inválido. Envie: !buscarcodigo WB-AAAAMMDD-XXXXX'; break; }
            const registro = historicoCodigosMensagem.get(codigo);
            if (!registro || registro.jid !== jid) { resposta = 'Não encontrei esse código nesta conversa. O histórico é temporário e fica disponível enquanto o bot está ligado.'; break; }
            resposta = `🔎 *MENSAGEM ENCONTRADA*\nCódigo: ${codigo}\nEnviada em: ${new Date(registro.criadoEm).toLocaleString('pt-BR')}\n\n${registro.conteudo || '(Mensagem sem texto; pode conter apenas mídia.)'}`;
            break;
        }

        case '!upd': {
            resposta = `🆕 *ATUALIZAÇÕES RECENTES DO WABOT*\n\n*V3.3.0 — Desempenho e estabilidade*\n• Histórico de mensagens salvo em lote, sem travar cada resposta esperando a gravação do JSON.\n• Histórico limitado a 250 mensagens por conversa e 300 conversas, evitando crescimento indefinido do arquivo.\n• Mensagens comuns que não acionam sistemas do bot deixam de ocupar as filas de comandos.\n• Diagnóstico de saúde agora informa tamanho das filas, conversas pendentes e histórico.\n• Salvamento agrupado com nova tentativa automática em caso de falha.\n\n*V3.2.9 — WABOT Poker*\n• Novo jogo individual de Poker contra o bot, com três níveis de dificuldade.\n• Mãos de cinco cartas, troca estratégica, avaliação das nove combinações clássicas e resultado ilustrado.\n• Mesa visual em PNG gerada com Sharp; cartas do bot ficam ocultas até o resultado.\n• Estatísticas de vitórias, derrotas, empates e partidas salvas em dados-sistemas-v310.json.\n• Sem apostas, WACoins ou dinheiro real.\n\n*V3.2.8 — Economia, profissões e cidades*\n• Fazendas compráveis, plantações temporizadas, colheita, estoque e venda de recursos.\n• Quatro profissões com requisitos de nível, salários, XP e produção de materiais.\n• Fundação de cidades globais, moradores, contribuições, reputação e ranking.\n• Construção de fazenda comunitária, serraria, pedreira, mercado e muralha com tesouro e materiais.\n\n*V3.2.7 — Catálogo de códigos de erro*\n• Novo !codigos lista as categorias internas de erro.\n• Novo !codigo NÚMERO explica descrição, causas possíveis e ação recomendada.\n• !erros agora associa cada ocorrência a um código de categoria, além do número sequencial.\n\n*V3.2.6 — Acessos extras e diagnóstico*\n• !masmorra comprar adquire +3 entradas diárias por 750 WACoins (um pacote por dia).\n• !erros [quantidade] lista erros recentes numerados; acesso restrito aos administradores.\n• !buscarcodigo WB-AAAAMMDD-XXXXX localiza mensagens do bot na conversa atual. Histórico temporário e limitado.\n\n*V3.2.5 — Expansão do RPG*\n• Nova masmorra persistente Fenda do Crepúsculo com cinco andares, inimigos escaláveis e chefe final.\n• Três expedições diárias, combate por turnos, poções, fuga e progresso salvo no perfil RPG.\n• Novos materiais: Fragmento Arcano e Núcleo Abissal.\n• Nova Forja: Poção grande, Espada rúnica (+20 ataque) e Escudo de cristal (+16 defesa).\n• Recompensas em XP e moedas RPG; materiais já obtidos são mantidos mesmo se o aventureiro for derrotado.\n\n*V3.2.4 — Edição de Natal*\n• Mensagens de texto e legendas recebem identificação individual WB-AAAAMMDD-XXXXX para facilitar suporte e rastreamento.\n• Identidade natalina automática nas mensagens até 02/01/2027.\n• Moldura natalina em imagens SVG geradas pelo bot, sem alterar os dados dos rankings.\n• Novo comando !presente: resgate diário ilustrado com WACoins e chance de bônus surpresa.\n• Novo Correio do Polo Norte com controle de resgate salvo em dados-wacoins.json.\n\n*V3.2.3 — RPG, pesca e sistemas sociais*\n• Chefes mundiais de 100.000, 150.000 e 250.000 HP, com recompensas muito maiores de XP, moedas RPG e WACoins.\n• Cinco novos inimigos, exploração com recompensas ampliadas e missões mais valiosas.\n• Guildas corrigidas: convites aceitam identificadores alternativos do WhatsApp e expiram em 7 dias.\n• Novo sistema de tripulações com até 8 pessoas, convites, capitão, pontuação coletiva e ranking por capturas.\n• Temporadas de pesca reiniciam automaticamente todo mês, com backup e preservação dos renascimentos e bônus permanentes.\n• Eventos temáticos automáticos com peixes exclusivos: Natal, Ano Novo, Carnaval, Páscoa, Festa Junina, Primavera e Halloween. Natal 2026 ativo até 02/01/2027.\n• Política: limite de 2 mandatos eleitos por pessoa; bloqueio de terceira eleição e registro persistente no JSON.\n\n*V3.2.2 — Eleição global e correção de subcomandos*
• !politica ranking e demais subcomandos preservam os argumentos após o comando principal.
• Eleição, partidos, candidaturas, votos, propostas e mandato são compartilhados entre todos os grupos.
• Dados políticos são persistidos em sistemas JSON e migram automaticamente dos registros antigos por grupo.

*V3.2.1 — Correção dos subcomandos políticos*\n• !politica ranking agora gera corretamente a imagem de classificação eleitoral.\n• !politica status, !politica partidos, !politica partido e !politica eleicao executam suas ações sem perder os argumentos.\n\n*V3.2.0 — Interpretação inteligente de comandos*\n• Correção automática de pequenos erros de digitação em comandos conhecidos.\n• Espaços extras depois do prefixo e entre argumentos são tratados corretamente.\n• Normalização de acentos e diferenças entre maiúsculas/minúsculas.\n• Sugestão de comando quando não há correspondência segura.\n\n*V3.1.9 — RPG expandido e política por grupo*\n• Quatro classes RPG: Guerreiro, Mago, Guardião e Ladino, com passivas e habilidades próprias.\n• Habilidades especiais com recarga e efeitos temporários em combate.\n• Sistema político compartilhado entre grupos, com partidos, candidaturas e votação para prefeito, vice e vereador.\n• Mandatos de sete dias e poderes exclusivos para os cargos.\n• Propostas públicas com votação dos membros.\n\n*V3.1.8 — Mares e renascimento da pesca*\n• Seis mares com peixes exclusivos e valores diferentes.\n• Acesso aos mares condicionado ao número de renascimentos.\n• Requisitos progressivos de capturas, peixes no inventário e WACoins.\n• Renascimento com confirmação em duas etapas.\n• Renascimento zera saldo e banco de WACoins, peixes, capturas e equipamentos.\n• Cada renascimento aumenta permanentemente sorte e peso.\n\n*V3.1.7 — Correções e melhorias*\n• Correção na exibição de nomes: prioriza nomes do WhatsApp e do grupo em vez de identificadores numéricos.\n• Melhor compatibilidade de fontes em imagens, com fallback para caracteres acentuados e emojis.\n• Ajustes de renderização e qualidade de imagens PNG.\n• Novo comando !upd para consultar as novidades.\n\n*V3.1.6 — Desempenho e estabilidade*\n• Filas de mensagens organizadas por conversa.\n• Processamento simultâneo limitado entre conversas.\n• Proteção contra mensagens duplicadas e filas excessivas.\n• Gravações JSON serializadas para reduzir conflitos.\n• Cache temporário de imagens limitado.\n• Reconexão progressiva e logs de diagnóstico.\n\n*V3.1.5 — Novos sistemas*\n• Árvore de habilidades do RPG.\n• Agendamento de resets de RPG e pesca.\n• Roleta com imagem de resultado.\n• Sistema de renascimento da pesca com bônus permanentes.`;
            break;
        }

        case '!helprpg': {
            resposta = `🧭 *GUIA DO RPG WABOT*\n\nO RPG é independente da pesca e dos WACoins. Possui níveis, XP, vida, combate, equipamentos, magias, classes e habilidades especiais.\n\n!rpg iniciar — criar personagem\n!rpg — ver status\n!rpg explorar — explorar\n!rpg atacar — atacar inimigo\n!rpg fugir — fugir\n!rpg curar — usar poção\n!rpg descansar — recuperar vida\n!rpg loja — loja\n!rpg comprar ID — comprar item\n!rpg inventario — inventário\n!rpg equipar ID — equipar item\n!rpg missao — missão\n!rpg arvore — imagem da árvore de evolução\n!rpg evoluir ataque/defesa/vida/magia — gastar ponto\n!rpg classe — escolher uma classe\n!rpg habilidade — ativar habilidade de classe\n!masmorra ajuda — Fenda do Crepúsculo (5 andares)\n!masmorra comprar — +3 acessos por 750 WACoins (1 pacote/dia)\n!forjar lista — receitas de equipamentos e poções\n!rpg fazenda — consultar fazenda e recursos\n!rpg fazenda comprar — comprar terreno\n!rpg plantar trigo|ervas|madeira — iniciar cultivo\n!rpg colher — colher produção pronta\n!rpg fazenda vender TIPO QTD — vender recursos\n!rpg trabalhos — listar profissões\n!rpg emprego NOME — escolher profissão\n!rpg trabalhar — cumprir expediente (4h de intervalo)\n!rpg cidade criar NOME — fundar cidade (5.000 moedas)\n!rpg cidade entrar ID — morar em cidade\n!rpg cidade ajudar VALOR — contribuir com o tesouro\n!rpg cidade doar RECURSO QTD — doar materiais\n!rpg cidade construir EDIFICIO — construir (fundador)\n!rpg cidade ranking — ver cidades existentes\n!rpg magias — ver magias e chances\n!rpg usar_liberador — roleta de poderes\n!rpg conjurar NOME — conjurar poder desbloqueado\n!masmorra entrar/status/atacar/avancar/curar/fugir — expedição de cinco andares\n!forjar lista/RECEITA — fabricar poções e equipamentos com materiais da masmorra\n!chefemundial iniciar [1|2|3]/status/atacar/conjurar NOME — chefes de 100k a 250k HP\n!tripulacao — criar tripulação de pesca, convidar e consultar ranking\n!presente — abrir presente diário do Correio do Polo Norte\n!temporadapesca — status da temporada mensal e evento temático\n!pvp @pessoa — duelo com magias\n!missoes — tarefas diárias e semanais\n\nClasses: guerreiro (dano), mago (magia), guardião (defesa), ladino (crítico). Use !rpg classe. Habilidades: !rpg habilidade.\n\nO Liberador de poder é comprado na loja do RPG. Cada uso sorteia uma magia ainda não desbloqueada; poderes mais raros têm chances menores.\n⭐ Nível: +15 HP máximo, +2 ataque, +1 defesa e 1 ponto de evolução.\n🌳 Evolução: !rpg arvore | !rpg evoluir ataque/defesa/vida/magia.\n🪙 Moedas RPG são separadas dos WACoins.`;
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
            await renascerPesca(sock,jid,participante,nome,args.join(' '));
            registrar = false;
            break;
        }
        case '!eleicao': {
            resposta = await processarEleicao(sock,jid,participante,nome,args,msg);
            break;
        }
        case '!partido': {
            resposta = await processarPartido(jid,participante,nome,args,msg);
            break;
        }
        case '!politica':
        case '!cargo': {
            const acaoPolitica = normalizar((interpretado.textoArgumentos || args.join(' ')).trim().split(/\s+/)[0] || 'ajuda');
            const cargo = cargoPoliticoDoUsuario(jid, participante);
            const g = jid.endsWith('@g.us') ? obterPoliticaGrupo(jid) : null;
            const m = g?.mandato;

            if (comando === '!cargo') {
                resposta = cargo
                    ? `🏛️ Você ocupa o cargo de *${cargo.toUpperCase()}* neste grupo. Use !poderpolitico status.`
                    : 'Você não ocupa cargo político ativo neste grupo.';
                break;
            }

            // Subcomandos de !politica são interpretados separadamente do comando principal.
            if (acaoPolitica === 'ranking') {
                if (!jid.endsWith('@g.us')) {
                    resposta = '🏛️ O ranking político só funciona dentro de grupos.';
                    break;
                }
                const imagemPolitica = await gerarImagemRankingPolitico(jid);
                await enviar(sock, jid, { image: imagemPolitica, caption: '🏛️ *RANKING POLÍTICO*\n\nCandidatos organizados por cargo e quantidade de votos reais.' });
                registrar = false;
                break;
            }

            if (acaoPolitica === 'status') {
                resposta = await processarEleicao(sock, jid, participante, nomeResolvido, ['status'], msg);
                break;
            }
            if (acaoPolitica === 'mandatos') {
                const alvo = obterMencoes(msg)[0] || participante;
                const quantidade = obterContagemMandatosPoliticos(obterPoliticaGrupo(jid), alvo);
                resposta = `🏛️ *HISTÓRICO DE MANDATOS*\nPessoa: ${nomeExibicao(alvo)}\nMandatos eleitos: ${quantidade}/2\n${quantidade >= 2 ? '🚫 Limite atingido: não pode concorrer novamente.' : `Pode conquistar mais ${2-quantidade} mandato(s).`} `;
                break;
            }

            if (acaoPolitica === 'partidos' || acaoPolitica === 'listarpartidos') {
                resposta = await processarPartido(jid, participante, nomeResolvido, ['listar'], msg);
                break;
            }

            if (acaoPolitica === 'partido') {
                resposta = await processarPartido(jid, participante, nomeResolvido, args.slice(1), msg);
                break;
            }

            if (acaoPolitica === 'eleicao') {
                resposta = await processarEleicao(sock, jid, participante, nomeResolvido, args.slice(1), msg);
                break;
            }

            resposta = `🏛️ *SISTEMA POLÍTICO*\n\n!politica ranking — gerar imagem do ranking eleitoral\n!politica status — consultar eleição e mandato\n!politica mandatos — consultar o limite de reeleições\n!politica partidos — listar partidos\n!politica partido criar NOME — criar partido\n!eleicao criar — administrador inicia eleição\n!eleicao candidatar prefeito/vice/vereador — candidatar-se\n!votar prefeito/vice/vereador @pessoa — votar\n!eleicao status/candidatos — consultar eleição\n!proposta TEXTO — proposta de um vereador\n!proposta votar ID sim/nao — votar proposta\n!poderpolitico status — consultar poderes\n\nMandato: 7 dias.\n${m && Date.now() < m.terminaEm ? `Prefeito: ${m.prefeito?.nome || '—'} | Vice: ${m.vice?.nome || '—'}` : 'Não há mandato ativo.'}`;
            break;
        }
        case '!poderpolitico': {
            resposta = await processarPoderPolitico(sock,jid,participante,nome,args,msg);
            break;
        }
        case '!proposta': {
            resposta = await processarPropostaPolitica(jid,participante,nome,args);
            break;
        }
        case '!mercado': {
            resposta = await processarMercado(participante, nome, args);
            break;
        }
        case '!guilda': {
            resposta = await processarGuilda(participante, nome, args, msg);
            break;
        }
        case '!guildas': {
            resposta = listarGuildas();
            break;
        }
        case '!tripulacao': {
            resposta = await processarTripulacao(participante,nome,args,msg);
            break;
        }
        case '!temporadapesca': {
            await verificarResetTemporadaPesca(false);
            const t=sistemasV310.temporadaPesca||{};
            const evento=obterEventoPescaAtivo();
            const prox=new Date(new Date(`${dataLocalISO()}T12:00:00-03:00`).getFullYear(),new Date(`${dataLocalISO()}T12:00:00-03:00`).getMonth()+1,1);
            resposta=`🎣 *TEMPORADA DE PESCA*\nTemporada: #${t.numeroTemporada||1}\nMês: ${t.mesAtual||dataLocalISO().slice(0,7)}\nPróximo reset: ${prox.toLocaleDateString('pt-BR')}\nO reset mensal limpa peixes, capturas, equipamentos e progresso sazonal, mas preserva renascimentos e bônus permanentes.\n\n${evento?`${evento.emoji} Evento ativo: ${evento.nome}\nTermina: ${new Date(evento.terminaEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}\nBônus de sorte: +${evento.bonusSorte}`:'Nenhum evento temático ativo.'}`;
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

        case '!masmorra': {
            resposta = await processarMasmorra(participante, nome, args);
            break;
        }

        case '!forjar': {
            resposta = await processarForja(participante, nome, args);
            break;
        }

        case '!poker': {
            resposta = await processarPoker(sock,jid,participante,nome,args);
            if (resposta === null) registrar = false;
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
                resposta = await processarRPG(participante, nome, args, jid);
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
!poker ajuda (poker individual contra o bot)
!upd (histórico de atualizações)\n!erros [quantidade] (diagnóstico, somente administrador)\n!codigos (catálogo de códigos de erro)\n!codigo 202 (detalhes de um código)\n!buscarcodigo WB-... (localizar mensagem nesta conversa)
!info
!doar @pessoa quantidade
!mercado (trocas entre jogadores)
!guilda criar NOME / !guilda / !guildas
!guilda convidar @pessoa / !guilda entrar ID
!tripulacao criar NOME / convidar / entrar / ranking / transferir
!temporadapesca (temporada mensal e eventos temáticos)
!presente (presente diário de Natal até 02/01/2027)
!diario / !sequencia
!missoes / !missao diaria|semanal
!chefemundial iniciar [1|2|3] / status / atacar
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
!mares / !mar nome (viajar entre mares desbloqueados)
!renascerpesca (requisitos e confirmação)
!rankingpesca
!venderpeixes (vende todos os peixes disponíveis)
!venderpeixes raridade (ex.: raro, epico, lendario)
!lojapesca (loja; compre com !1, !2, etc.)
!eventopesca iniciar taco 30 3 (admin; também mare, estrelas, abismo)
!evento (ver tempo restante do evento)
!comprarpesca ID (ou escolha um número na loja)
Itens extras: acelerador_1/2/3, peso_1/2/3, anel_1/2/3, relicario_1/2/3, pingente_1/2/3 e linha_1/2/3/4/5

🧩 *JOGOS*
!poker iniciar [facil|normal|dificil]
!poker dificuldade facil|normal|dificil
!poker trocar 1 3 5 / manter / mesa / ranking
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
            resposta = `${evento.emoji} *EVENTO DE PESCA ATIVO*${evento.tematico ? ' — TEMÁTICO AUTOMÁTICO' : ''}\n\n${evento.nome}\n⏳ Tempo restante: *${formatarTempoEvento(evento.terminaEm - Date.now())}*\n🍀 Bônus de sorte: +${evento.bonusSorte}\n🐟 Peixes exclusivos disponíveis.`;
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

        case '!mares': {
            resposta = montarListaMaresPesca(obterDadosPescador(participante, nome));
            break;
        }

        case '!mar': {
            await selecionarMarPesca(sock, jid, participante, nome, args.join(' '));
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
            if (['prefeito','vice','vereador'].includes(normalizar(args[0] || ''))) {
                resposta = await processarVotoPolitico(jid,participante,args,msg);
                break;
            }
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
        // CORREIO DO POLO NORTE — PRESENTE DIÁRIO
        // ==========================================

        case '!presente': {
            if (!estaNaEdicaoNatalina()) {
                resposta = '🎁 O Correio do Polo Norte está fechado. O presente diário fica disponível durante a edição natalina, de 23/11/2026 a 02/01/2027.';
                break;
            }

            carteirasWACoins.__presentesNatal ||= {};
            const chavePresente = encontrarChaveUsuario(carteirasWACoins.__presentesNatal, participante) || participante;
            const registroPresente = carteirasWACoins.__presentesNatal[chavePresente] || {};
            const hojePresente = dataLocalISO();
            if (registroPresente.ultimaData === hojePresente) {
                resposta = `🎄 Você já abriu seu presente de hoje, *${nome}*!\n\nO próximo presente estará disponível amanhã.\n🎅 Último resgate: ${registroPresente.codigo || 'registrado'}.`;
                break;
            }

            const recompensa = randomInt(80, 181);
            const extra = randomInt(1, 101) <= 12;
            const total = recompensa + (extra ? 120 : 0);
            const carteiraPresente = obterCarteira(participante, nome);
            carteiraPresente.saldo = Math.round((Number(carteiraPresente.saldo || 0) + total) * 100) / 100;
            const codigoPresente = `NATAL-${hojePresente.replace(/-/g, '')}-${randomInt(1000, 10000)}`;
            carteirasWACoins.__presentesNatal[chavePresente] = {
                ultimaData: hojePresente,
                codigo: codigoPresente,
                totalResgatado: Number(registroPresente.totalResgatado || 0) + total,
                quantidadeResgates: Number(registroPresente.quantidadeResgates || 0) + 1
            };
            await salvarWACoins();

            const imagemPresente = await gerarImagemPresenteNatal(nome, total, extra);
            const legendaPresente = `🎁 *PRESENTE RESGATADO!*\n\n${extra ? '✨ Você encontrou um bônus surpresa de 120 WACoins!\n' : ''}💰 Recompensa: *${formatarWACoins(total)}*\n🎅 Código do presente: ${codigoPresente}\n📅 Próximo presente: amanhã\n\nUse !presente uma vez por dia até 02/01/2027.`;
            await enviar(sock, jid, { image: imagemPresente, caption: legendaPresente });
            resposta = '';
            registrar = false;
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

Comando: ${comando}${interpretado.sugestao ? `

Você quis dizer *${interpretado.sugestao}*?` : ''}

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

    // Mensagens comuns de conversa não precisam ocupar a fila do bot.
    // Mantém comandos, respostas de entrevistas, seleções numéricas da loja e fotos
    // (que podem ser usadas pelo comando !figurinha).
    const conteudo = extrairTexto(msg.message).trim();
    const participante = obterParticipante(msg);
    const chaveMenu = `${jid}:${participante}`;
    const ehComando = mensagemTemPrefixo(conteudo);
    const ehRespostaEntrevista = jid.endsWith('@g.us') && entrevistasAtivas.has(jid) && !ehComando;
    const ehSelecaoLoja = menusLojaPesca.has(chaveMenu) && (/^!?\d+$/.test(conteudo));
    const contemImagem = Boolean(msg.message.imageMessage ||
        msg.message.ephemeralMessage?.message?.imageMessage ||
        msg.message.viewOnceMessage?.message?.imageMessage ||
        msg.message.viewOnceMessageV2?.message?.imageMessage);
    if (!ehComando && !ehRespostaEntrevista && !ehSelecaoLoja && !contemImagem) return;

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
    const maiorFila = Math.max(0, ...[...filasMensagens.values()].map(f => f.itens.length));
    console.log(`[SAÚDE] RSS=${Math.round(memoria.rss / 1024 / 1024)}MB heap=${Math.round(memoria.heapUsed / 1024 / 1024)}MB ativos=${processamentosAtivos}/${MAX_PROCESSAMENTOS_SIMULTANEOS} pendentes=${mensagensPendentes} maiorFila=${maiorFila} conversasFila=${filasMensagens.size} historico=${Object.keys(mensagensComando).length}`);
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

// Grava o histórico pendente em encerramentos controlados do processo.
for (const sinal of ['SIGINT', 'SIGTERM']) {
    process.on(sinal, () => {
        salvarMensagensPendente()
            .catch(erro => console.error('[PERSISTÊNCIA] Não foi possível concluir o salvamento final:', erro?.message || erro))
            .finally(() => process.exit(0));
    });
}

// ==================================================
// INICIALIZAÇÃO
// ==================================================

await carregarDados();

iniciarBot().catch(erro => {
    console.error('Falha ao iniciar o WABOT:', erro);
});
})().catch(erro => {
    console.error('[WABOT 3.3.0] ERRO FATAL NA INICIALIZAÇÃO:');
    console.error(erro?.stack || erro);
    process.exitCode = 1;
});

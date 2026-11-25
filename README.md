# WABOT
### Um universo de jogos dentro do WhatsApp

**Versão atual:** 3.3.0  
**Desenvolvedor:** Ghostine  
**Linguagem:** JavaScript  
**Runtime:** Node.js  
**Biblioteca de conexão:** Baileys

---

## 1. Sobre o projeto

O WABOT é um bot multifuncional para WhatsApp, desenvolvido com o objetivo de transformar grupos em ambientes interativos, com jogos, sistemas de progressão, economia virtual e diversas atividades.

O projeto possui diferentes sistemas independentes que se complementam, oferecendo experiências que vão desde minijogos até sistemas mais elaborados de RPG.

Seu desenvolvimento é independente e está em constante evolução, recebendo atualizações, correções e novas funcionalidades.

## 2. Edição especial de Natal

Atualmente, o WABOT está em sua edição especial de Natal, com uma identidade visual temática e funcionalidades sazonais.

O período natalino está programado no código para ocorrer de **23 de novembro de 2026 até 2 de janeiro de 2027**.

Entre os elementos dessa edição estão:

- Identidade visual natalina nas mensagens.
- Molduras especiais em imagens geradas pelo bot.
- Presentes de Natal com recompensas em WACoins.
- Elementos visuais inspirados no Natal.
- Personalização temática de mensagens e imagens.

A edição é temporária e foi desenvolvida para proporcionar uma experiência especial durante o período de festas.

Após o encerramento do evento, a identidade visual sazonal poderá deixar de ser aplicada automaticamente.

## 3. Funcionalidades

O WABOT possui diversos sistemas.

### RPG
Um sistema de RPG com progressão, exploração, combate, classes, habilidades, equipamentos e missões.

Inclui:
- Sistema de níveis e experiência.
- Magias e habilidades especiais.
- Chefes com grandes quantidades de vida.
- Masmorras com múltiplos andares.
- Sistema de guildas.
- Sistema de PvP.
- Mercado de jogadores.
- Forja de equipamentos.
- Fazendas, plantações e recursos.
- Cidades e profissões.
- Chefes mundiais.

### Pesca
Um sistema de pesca com progressão própria e diferentes categorias de raridade.

Inclui:
- Diversas espécies de peixes.
- Equipamentos e melhorias.
- Diferentes mares.
- Sistema de renascimento.
- Temporadas de pesca.
- Eventos especiais.
- Rankings e estatísticas.
- Tripulações.

### Economia virtual
O WABOT possui uma economia interna baseada em WACoins.

Os recursos incluem:
- Carteiras individuais.
- Banco com rendimento.
- Transferências e doações.
- Recompensas de atividades.
- Integração com outros sistemas do bot.

Os WACoins são uma moeda virtual exclusiva do ambiente do WABOT, sem valor monetário real.

### Jogos e entretenimento
O bot também disponibiliza atividades independentes:

- Quiz normal e difícil.
- Poker contra o próprio WABOT.
- Jogo da velha.
- Forca.
- Anagramas.
- Enquetes.
- Roletas e jogos de sorte.
- Desafios interativos.

O poker possui diferentes níveis de dificuldade e funciona sem apostas ou dinheiro.

### Perfis e personalização
Os participantes podem utilizar sistemas de perfil com estatísticas, títulos, molduras e outras opções de personalização.

### Ferramentas administrativas
O WABOT também possui recursos de administração e diagnóstico, incluindo:

- Controle de manutenção.
- Gerenciamento de entrevistas.
- Histórico de atualizações.
- Registro de erros.
- Códigos individuais para mensagens.
- Pesquisa de mensagens por código.
- Controle de atividades administrativas.

## 4. Hospedagem e instalação

O WABOT foi desenvolvido em Node.js e pode ser executado em um computador ou em uma hospedagem compatível.

### Enzonic

O projeto pode ser hospedado no Enzonic, desde que o plano e o ambiente disponibilizados ofereçam suporte às dependências necessárias.

Isso permite manter o bot funcionando sem precisar deixar o computador pessoal ligado.

Para realizar a hospedagem, é necessário:

1. Enviar os arquivos do projeto.
2. Configurar o ambiente Node.js.
3. Instalar as dependências.
4. Configurar o comando de inicialização.
5. Iniciar o bot.
6. Realizar o pareamento com o WhatsApp pelo QR Code, quando necessário.

### Dependências principais

- `@whiskeysockets/baileys`
- `qrcode-terminal`
- `sharp`

As demais dependências devem ser instaladas conforme o `package.json` do projeto.

### Estrutura de arquivos

Uma estrutura básica esperada é:

```text
WABOT/
│
├── index.js
├── package.json
├── package-lock.json
│
├── midia/
│   ├── help.png
│   ├── ranking.png
│   ├── ON.png
│   ├── OFF.png
│   ├── MANUTENCAO.png
│   │
│   └── Gifs/
│
├── sessao/
│
├── pontuacao-quiz.json
├── mensagens-bot.json
├── personalizacao-perfil.json
├── dados-pesca.json
├── entrevistas.json
├── wacoins.json
├── dados-rpg.json
└── dados-sistemas-v310.json
```

Os arquivos JSON de dados podem ser criados automaticamente pelo bot quando não existem.

**Importante:** a pasta `sessao` contém informações de autenticação do WhatsApp. Não compartilhe essa pasta publicamente. Também é necessário preservar os arquivos de dados para evitar perder o progresso dos jogadores.

## 5. Termos de uso

O WABOT é um projeto independente, disponibilizado para fins de entretenimento, aprendizado e utilização comunitária.

Ao utilizar ou redistribuir o projeto, devem ser respeitadas as seguintes condições:

### 5.1. Uso não comercial

O WABOT não pode ser comercializado diretamente.

É proibido:
- Vender o acesso ao bot.
- Cobrar por funcionalidades.
- Comercializar licenças de utilização.
- Vender os sistemas internos do projeto.
- Transformar o WABOT em um serviço pago.

### 5.2. Proibição de lucro direto

O projeto não deve ser utilizado como fonte de lucro direto.

Sua utilização deve permanecer voltada ao entretenimento, à comunidade e ao desenvolvimento pessoal.

### 5.3. Créditos e autoria

A autoria original do projeto deve ser preservada.

Não é permitido apresentar o WABOT original como se tivesse sido desenvolvido por outra pessoa.

### 5.4. Modificações

É permitido estudar e modificar o código para uso pessoal, respeitando a autoria original e as demais condições destes termos.

### 5.5. Redistribuição

A redistribuição deve preservar os créditos do desenvolvedor e os termos de utilização.

### 5.6. Responsabilidade de utilização

O usuário é responsável pela utilização do bot, pela configuração da hospedagem e pelo cumprimento das regras do WhatsApp e dos serviços utilizados.

### 5.7. Atualizações dos termos

Os termos poderão ser atualizados conforme a evolução do projeto.

## 6. Tecnologias utilizadas

O WABOT utiliza tecnologias voltadas à automação, comunicação e processamento de imagens.

| Tecnologia | Utilização |
|---|---|
| JavaScript | Linguagem principal |
| Node.js | Ambiente de execução |
| Baileys | Comunicação com WhatsApp |
| Sharp | Processamento e geração de imagens |
| QRCode Terminal | Exibição de QR Code |
| JSON | Persistência de dados |

## 7. Créditos

**Projeto:** WABOT  
**Desenvolvimento:** Ghostine  
**Versão:** 3.3.0

O WABOT é um projeto independente, desenvolvido com dedicação e atualização contínua.

---

*WABOT — Um universo de possibilidades dentro do WhatsApp.*

# 🤖 Bot Gerenciador de Demandas WhatsApp

Bot inteligente para gerenciar admins e comandos em grupos de WhatsApp utilizando whatsapp-web.js e MongoDB.

## 📋 Requisitos

- Node.js v16+
- MongoDB (local ou cloud - MongoDB Atlas)
- WhatsApp ativo em um smartphone/tablet

## 🚀 Instalação

### 1. Clone e instale dependências

```bash
npm install
```

### 2. Configure as variáveis de ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/whatsapp-bot
# ou para MongoDB Atlas:
# MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/whatsapp-bot

MONGODB_USER=seu_usuario
MONGODB_PASSWORD=sua_senha

NODE_ENV=development
BOT_NAME=Bot Gerenciador
DEBUG=false
```

### 3. Inicie o bot

```bash
npm start
```

Na primeira vez, você verá um QR code no terminal. **Escaneie-o com seu WhatsApp** para conectar o bot.

## 📱 Comandos Disponíveis

### #admin
Define o primeiro admin do grupo ou designa um novo admin respondendo a uma mensagem.

**Uso:**
- Primeira pessoa a usar: se torna o primeiro admin
- Admin respondendo à mensagem de alguém: designa essa pessoa como novo admin
- Segunda pessoa sem ser admin: recebe uma bronca

**Exemplo:**
```
Responda a mensagem de alguém com: #admin
```

### #renunciar
Remove você do cargo de admin do grupo.

**Exemplo:**
```
#renunciar
```

### Comando desconhecido
Qualquer hashtag que não existe retorna uma mensagem indicando comando desconhecido.

## 💾 Estrutura do Banco de Dados

### Coleção: GroupAdmins

Armazena informações dos admins de cada grupo:

```json
{
  "_id": "ObjectId",
  "groupId": "123456789-1234567890@g.us",
  "groupName": "Nome do Grupo",
  "admins": [
    {
      "userId": "5541987654321@c.us",
      "userName": "João Silva",
      "phoneNumber": "5541987654321",
      "assignedAt": "2026-02-20T10:30:00Z",
      "assignedBy": "5541987654310@c.us"
    }
  ],
  "totalAdmins": 1,
  "createdAt": "2026-02-20T10:30:00Z",
  "updatedAt": "2026-02-20T10:30:00Z"
}
```

### Coleção: CommandLogs

Registra todos os comandos executados:

```json
{
  "_id": "ObjectId",
  "groupId": "123456789-1234567890@g.us",
  "groupName": "Nome do Grupo",
  "userId": "5541987654321@c.us",
  "userName": "João Silva",
  "command": "#admin",
  "message": "#admin",
  "status": "success",
  "response": "João Silva se tornou o primeiro admin do grupo 👑",
  "createdAt": "2026-02-20T10:30:00Z"
}
```

## 🔧 Estrutura de Arquivos

```
whatsapp-bot-gerenciador/
├── index.js                  # Arquivo principal
├── package.json
├── .env.example              # Template de variáveis de ambiente
├── config/
│   └── database.js           # Configuração MongoDB
├── models/
│   ├── GroupAdmin.js         # Schema de admins
│   └── CommandLog.js         # Schema de logs de comandos
└── handlers/
    └── commandHandler.js     # Processador de comandos
```

## 🔐 Segurança

- Credenciais do WhatsApp são salvas localmente em `~/.wwebjs_auth/`
- MongoDB URI sensível deve estar em `.env` (não commitado)
- Sempre use `.env.example` como referência

## 🐛 Debugging

Para ativar logs detalhados, altere no `.env`:

```env
DEBUG=true
```

## 📚 Próximos Passos

Para adicionar novos comandos:

1. Adicione o novo comando em `handlers/commandHandler.js` no switch case
2. Implemente a lógica do comando
3. Registre no banco de dados conforme necessário
4. Teste em um grupo

## 🆘 Troubleshooting

### QR Code não aparece

Certifique-se de:
- Terminal suportando emojis UTF-8
- Não estar rodando em Docker/WSL sem configuração especial
- Node.js versão compatível

### Conexão recusada ao MongoDB

Verifique:
- MongoDB está rodando: `mongosh` ou verificar process
- URI está correta no `.env`
- Credenciais corretas
- Para MongoDB Atlas, verifique whitelist de IP

### Bot desconecta frequentemente

- Aumente o timeout do Puppeteer
- Reduza requisições simultâneas
- Verifique conexão de internet

## 📖 Referências

- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
- [Mongoose](https://mongoosejs.com/)
- [MongoDB](https://www.mongodb.com/)

---

**Desenvolvido com ❤️**

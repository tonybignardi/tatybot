# 🚀 GUIA RÁPIDO - Bot WhatsApp Gerenciador

## 1️⃣ Primeiro Setup

### Instalar dependências
```bash
npm install
```

### Criar arquivo .env
```bash
cp .env.example .env
```

### Editar arquivo .env com seus dados
```env
MONGODB_URI=mongodb://...seu_banco...
MONGODB_USER=seu_usuario
MONGODB_PASSWORD=sua_senha
NODE_ENV=development
```

### Iniciar o bot
```bash
npm start
```

**Você verá um QR code → Escaneie com WhatsApp**

---

## 2️⃣ Comandos do Bot em Grupos

### #admin (Primeiro)
```
Primeira pessoa que usar #admin:
✅ Se torna admin automaticamente

Segunda pessoa que tentar:
❌ Recebe uma bronca (já existe admin)
```

### #admin (Designar novo admin)
```
Admin responde à mensagem de alguém:
Responda com: #admin
✅ Essa pessoa vira admin também
```

### #renunciar
```
Admin usa: #renunciar
✅ Sai do cargo de admin
```

### Qualquer outro comando
```
Usuario: #comando_que_nao_existe
Bot: "Comando desconhecido ❌"
```

---

## 3️⃣ Gerenciar Dados no MongoDB

### Ver dados salvos
```bash
npm run admin
# ou
node admin.js
```

Menu interativo para:
- Listar grupos e admins
- Ver histórico de comandos
- Buscar grupo específico
- Deletar grupo

---

## 4️⃣ Estrutura do Projeto

```
├── index.js              👈 Bot principal
├── admin.js              👈 Gerenciador de dados
├── .env                  👈 Suas configurações
├── config/
│   └── database.js       👈 Conexão MongoDB
├── models/
│   ├── GroupAdmin.js     👈 Schema de admins
│   └── CommandLog.js     👈 Schema de logs
└── handlers/
    └── commandHandler.js 👈 Processador de comandos
```

---

## 5️⃣ MongoDB Connection String Examples

### Local
```
MONGODB_URI=mongodb://localhost:27017/whatsapp-bot
```

### MongoDB Atlas (Cloud)
```
MONGODB_URI=mongodb+srv://usuario:senha@cluster0.mongodb.net/whatsapp-bot
```

---

## 6️⃣ Troubleshooting

### Bot não inicia
- Verificar se MongoDB está rodando
- Verificar se Node.js está instalado (v16+)
- Verificar se .env tem dados corretos

### QR Code não aparece
- Usar terminal com suporte a UTF-8
- Limpar node_modules e reinstalar

### Não consegue conectar ao MongoDB
- Testar conexão: `mongosh "seu_connection_string"`
- Para Atlas, permitir IP 0.0.0.0 ou seu IP

---

## 7️⃣ Próximas Funcionalidades

Para adicionar novos comandos:

1. Edite `handlers/commandHandler.js`
2. Adicione case no switch de comandos
3. Implemente a lógica
4. Teste em um grupo

---

**Precisa de ajuda?** Verifique [README.md](README.md) para detalhes completos!

const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@adiwajshing/baileys');

const store = {};

const getMessage = key => {
    const { id } = key;
    if (store[id]) return store[id].message;
};

async function handleMirror(msg, sock) {
    const { key, message } = msg;
    const text = getText(message);
    const prefix = '!mirror';
    if (!text.startsWith(prefix)) return;
    const reply = text.slice(prefix.length);
    await sendMessage(key.remoteJid, { text: reply }, { quoted: msg });
}

async function handleAll(msg, sock) {
    const { key, message } = msg;
    const text = getText(message);
    if (!text.toLowerCase().includes('@all')) return;
    const group = await sock.groupMetadata(key.remoteJid);
    const members = group.participants;
    const mentions = [];
    const items = [];
    members.forEach(({ id, admin }) => {
        mentions.push(id);
        items.push(`@${id.slice(0, 12)}${admin ? " Kingpin" : ""}`);
    });
    await sendMessage(key.remoteJid, { text: '[all]' + items.join(", "), mentions }, { quoted: msg });
}

async function eventProcessor(events, sock, saveCreds) {
    if (events["connection.update"]) {
        const { connection, lastDisconnect } = events['connection.update'];
        if (connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                await WAbot();
            } else {
                console.log("Disconnected because you logged out.");
            }
        }
    }

    if (events['creds.update']) {
        await saveCreds();
    }

    if (events["messages.upsert"]) {
        const { messages } = events["messages.upsert"];
        messages.forEach(msg => {
            if (!msg.message) return;
            handleMirror(msg, sock);
            handleAll(msg, sock);
        });
    }
}

async function WAbot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth');

        const sock = makeWASocket({
            printQRInTerminal: true,
            auth: state,
            getMessage,
        });

        sock.ev.on('process', async (events) => {
            await eventProcessor(events, sock, saveCreds);
        });

    } catch (error) {
        console.error("Error in WAbot:", error);
    }
}

async function sendMessage(jid, content, ...args) {
    try {
        const sent = await sock.sendMessage(jid, content, ...args);
        store[sent.key.id] = sent;
    } catch (err) {
        console.error("Error sending message:", err);
    }
}

function getText(message) {
    try {
        return message.conversation || message.extendedTextMessage.text;
    } catch {
        return '';
    }
}

WAbot();

const makeWASocket = require('@adiwajshing/baileys').default;
const {
    DisconnectReason,
    useMultiFileAuthState,
} = require("@adiwajshing/baileys");



const store = {};
const getMessage = key => {
    const { id } = key;
    if(store[id]) return store[id].message;
};


async function WAbot()
{
    const {state, saveCreds}= await useMultiFileAuthState('auth');

    const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state, 
    getMessage,
    });


    const getText = message =>{
        try{
            return message.conversation || message.extendedTextMessage.text
        } catch{
            return '';
        }
    }


    const sendMessage = async (jid, content,...args) =>{
        try{
        const sent = await sock.sendMessage(jid,content,...args);
        store[sent.key.id] = sent;
        } catch(err){
            console.error("Error sending message:",err);
        }
    }

    const handleMirror = async (msg)=>{
        const {key, message} = msg;
        const text = getText(message);

        const prefix = '!mirror'

        if(!text.startsWith(prefix)) return;

        const reply = text.slice(prefix.length);
        sendMessage(key.remoteJid,{text: reply}, {quoted: msg});


    }

    const handleAll = async (msg) =>{
        const {key, message} = msg;
        const text = getText(message);

        //@all @ALL #ALL
        if(!text.toLowerCase().includes('@all')) return;

        // 1.get all group memebers
        //2. tag em and reply
        const group = await sock.groupMetadata(key.remoteJid);
        const members = group.participants;

        const mentions = [];
        const items = [];

        members.forEach(({id, admin})=>{
            mentions.push(id);
            items.push('@${id.slice(0,12)}${admin ? "Kingpin": ""}');
        })
        sendMessage(key.remoteJid, {text: '[all]' + items.join(", "), mentions},
        {quoted: msg}
        );
    };

    sock.ev.process(async (events) => {
        if(events["connection.update"]){
            const { connection, lastDisconnect } = events['connection.update'];
            if(connection==="close"){
                if(lastDisconnect?.error?.output?.statusCode !==
                    DisconnectReason.loggedOut
                    ){
                        WAbot();
                    }
                    else{
                        console.log("Disconnected because you logged out.");
                    }
            }
        }

        if(events['creds.update']){
            await saveCreds();
        }

        if(events["messages.upsert"]){
            const {messages} = events["messages.upsert"];
            //mirror helllo

            messages.forEach(msg => {
                if(!msg.message) return;
                //helllo
                handleMirror(msg);
                handleAll(msg);
            })
        }
    });
}

WAbot();
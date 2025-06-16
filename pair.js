const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const pino = require('pino');
const logger = pino({ level: 'info' });
const {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore,
    DisconnectReason,
} = require('@whiskeysockets/baileys');
const { upload } = require('./mega');

// Function to remove files/directories
function removeFile(filePath) {
    if (!fs.existsSync(filePath)) return false;
    fs.rmSync(filePath, { recursive: true, force: true });
}

// Function to generate a random pairing code
function generateRandomText() {
    const prefix = "3EB";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let randomText = prefix;
    for (let i = prefix.length; i < 22; i++) {
        randomText += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return randomText;
}

// Main pairing function
async function GIFTED_MD_PAIR_CODE(id, num, res) {
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'temp', id));
    try {
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            generateHighQualityLinkPreview: true,
            logger: logger,
            syncFullHistory: false,
            browser: Browsers.macOS('Safari'), // Use Safari as the browser
        });

        if (!sock.authState.creds.registered) {
            await delay(1500);
            num = num.replace(/[^0-9]/g, '');
            const code = await sock.requestPairingCode(num);
            if (!res.headersSent) {
                res.send({ code });
            }
        }

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                await delay(5000);
                const credsFilePath = path.join(__dirname, 'temp', id, 'creds.json');
                try {
                    const megaUrl = await upload(fs.createReadStream(credsFilePath), `${sock.user.id}.json`);
                    const stringSession = megaUrl.replace('https://mega.nz/file/', '');
                    const md = "SANIJA-MD=" + stringSession;
                    const codeMessage = await sock.sendMessage(sock.user.id, { text: md });

                    const desc = `ᴅᴏɴ'ᴛ sʜᴇʀᴇ ᴛʜɪs ᴄᴏᴅᴇ ᴡɪᴛʜ ᴀɴʏᴏɴᴇ. ʏᴏᴜ ᴄᴀɴ ᴜsᴇ ᴛʜɪs sᴇssɪᴏɴ ɪᴅ ᴛᴏ ᴄʀᴇᴀᴛᴇ sᴀɴɪᴊᴀ-ᴍᴅ ᴡʜᴀᴛsᴀᴘᴘ ᴜsᴇʀ ʙᴏᴛ*\n\n ◦ɢɪᴛʜᴜʙ:* https://github.com/sanijanimofc/sanija-md`;
                    await sock.sendMessage(sock.user.id, {
                        text: desc,
                        contextInfo: {
                            externalAdReply: {
                                title: "SANIJA MD",
                                thumbnailUrl: "https://telegra.ph/file/e069027c2178e2c7475c9.jpg",
                                sourceUrl: "https://www.whatsapp.com/channel/0029Vai5pJa5vK9zcGR1PX2f",
                                mediaType: 1,
                                renderLargerThumbnail: true,
                            },
                        },
                    }, { quoted: codeMessage });

                    await sock.ws.close();
                    removeFile(path.join(__dirname, 'temp', id));
                    logger.info(`👤 ${sock.user.id} 𝗖𝗼𝗻𝗻𝗲𝗰𝘁𝗲𝗱 ✅ 𝗥𝗲𝘀𝘁𝗮𝗿𝘁𝗶𝗻𝗴 𝗽𝗿𝗼𝗰𝗲𝘀𝘀...`);
                    process.exit(0);
                } catch (error) {
                    logger.error(`Error uploading file: ${error.message}`);
                    const errorMessage = await sock.sendMessage(sock.user.id, { text: error.message });
                    await sock.sendMessage(sock.user.id, {
                        text: `* ᴅᴏɴ'ᴛ sʜᴇʀᴇ ᴛʜɪs ᴄᴏᴅᴇ ᴡɪᴛʜ ᴀɴʏᴏɴᴇ. ʏᴏᴜ ᴄᴀɴ ᴜsᴇ ᴛʜɪs sᴇssɪᴏɴ ɪᴅ ᴛᴏ ᴄʀᴇᴀᴛᴇ sᴀɴɪᴊᴀ-ᴍᴅ ᴡʜᴀᴛsᴀᴘᴘ ᴜsᴇʀ ʙᴏᴛ*\n\n ◦ɢɪᴛʜᴜʙ:* https://github.com/sanijanimofc/sanija-md`,
                        contextInfo: {
                            externalAdReply: {
                                title: "SANIJA MD",
                                thumbnailUrl: "https://telegra.ph/file/e069027c2178e2c7475c9.jpg",
                                sourceUrl: "https://www.whatsapp.com/channel/0029Vai5pJa5vK9zcGR1PX2f",
                                mediaType: 2,
                                renderLargerThumbnail: true,
                                showAdAttribution: true,
                            },
                        },
                    }, { quoted: errorMessage });
                }
            } else if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
                logger.warn('Connection closed. Retrying...');
                await delay(10000); // Wait 10 seconds before retrying
                GIFTED_MD_PAIR_CODE(id, num, res);
            }
        });
    } catch (error) {
        logger.error(`Error in GIFTED_MD_PAIR_CODE: ${error.message}`);
        removeFile(path.join(__dirname, 'temp', id));
        if (!res.headersSent) {
            res.send({ code: "❗ Service Unavailable" });
        }
    }
}

// Route handler
router.get('/', async (req, res) => {
    const id = makeid();
    const num = req.query.number;
    if (!num) {
        return res.status(400).send({ error: 'Number is required' });
    }
    await GIFTED_MD_PAIR_CODE(id, num, res);
});

// Restart process every 30 minutes
setInterval(() => {
    logger.info('☘️ 𝗥𝗲𝘀𝘁𝗮𝗿𝘁𝗶𝗻𝗴 𝗽𝗿𝗼𝗰𝗲𝘀𝘀...');
    process.exit(0);
}, 1800000); // 30 minutes

module.exports = router;

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const fetch = require('node-fetch');

const app = express();
app.use(express.static('public'));
app.use(express.json());

mongoose.connect(process.env.AZURE_COSMOS_CONNECTION_STRING).then(() => console.log('Azure verbunden'));

const Resume = mongoose.model('Resume', new mongoose.Schema({
    encryptedData: String, name: String, isRead: { type: Boolean, default: false }, uploadDate: { type: Date, default: Date.now }
}));

// Neu erstellen (Manuell oder via JSON-Import)
app.post('/resumes/manual', async (req, res) => {
    const r = new Resume(req.body); await r.save();
    
    // Deinen JSONBIN Backup-Code habe ich drin gelassen, falls du ihn nutzt
    if (process.env.JSONBIN_API_KEY) {
        fetch('https://api.jsonbin.io/v3/b', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-Master-Key': process.env.JSONBIN_API_KEY},
            body: JSON.stringify(req.body)
        });
    }
    res.json(r);
});

// Aktualisieren
app.put('/resumes/:id', async (req, res) => { res.json(await Resume.findByIdAndUpdate(req.params.id, req.body)); });

// Alle abrufen
app.get('/resumes', async (req, res) => { res.json(await Resume.find()); });

// Gelesen-Status patchen
app.patch('/resumes/:id', async (req, res) => { await Resume.findByIdAndUpdate(req.params.id, { isRead: req.body.isRead }); res.sendStatus(200); });

// Lösch-Route
app.delete('/resumes/:id', async (req, res) => { 
    try {
        await Resume.findByIdAndDelete(req.params.id); 
        res.sendStatus(200); 
    } catch (e) {
        res.status(500).send("Fehler beim Löschen");
    }
});

// Port für Cloud-Hosting angepasst
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Online-Server läuft auf Port ${PORT}`));
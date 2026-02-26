let vaultKey = ""; 
let allResumes = [];

// --- TRESOR LOGIK ---
async function unlockVault() {
    const input = document.getElementById('masterPassword').value;
    if (!input) return alert("Bitte geben Sie ein Passwort ein.");

    vaultKey = input;
    
    try {
        const res = await fetch('/resumes');
        const rawData = await res.json();
        
        const encryptedEntry = rawData.find(item => item.encryptedData);
        
        if (encryptedEntry) {
            const testDecrypt = decrypt(encryptedEntry.encryptedData);
            
            if (!testDecrypt) {
                vaultKey = ""; 
                document.getElementById('masterPassword').value = ""; 
                alert("Zugriff verweigert: Falsches Master-Passwort!");
                return; 
            }
        }
        
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('mainContainer').classList.remove('blurred');
        
        renderList(rawData);
        
    } catch (e) {
        console.error("Datenbank-Fehler:", e);
        alert("Es konnte keine Verbindung zur Datenbank hergestellt werden.");
    }
}

function lockVault() {
    vaultKey = "";
    location.reload(); 
}

// --- VERSCHLÜSSELUNG ---
function encrypt(obj) {
    return CryptoJS.AES.encrypt(JSON.stringify(obj), vaultKey).toString();
}

function decrypt(ciphertext) {
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, vaultKey);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        if (!originalText) return null; 
        return JSON.parse(originalText);
    } catch (e) { return null; }
}

// --- DATEN-HANDLING ---
async function loadDatabase() {
    try {
        const res = await fetch('/resumes');
        const rawData = await res.json();
        renderList(rawData);
    } catch (e) { console.error("Fehler", e); }
}

function renderList(rawData) {
    const tbody = document.getElementById('savedResumesBody');
    
    allResumes = rawData.map(item => {
        if (item.encryptedData) {
            const dec = decrypt(item.encryptedData);
            return dec ? { ...item, ...dec, secure: true } : { ...item, name: "🔒 Gesperrt", email: "🔒 Gesperrt", birthDate: "🔒 Gesperrt", secure: false };
        }
        return { ...item, secure: true, old: true };
    });

    tbody.innerHTML = allResumes.map((r, i) => `
        <tr class="clickable-row ${r.isRead ? 'is-read' : ''}" onclick="showDetails(${i})">
            <td class="checkbox-cell" onclick="event.stopPropagation()">
                <input type="checkbox" ${r.isRead ? 'checked' : ''} onchange="toggleReadStatus('${r._id}', this.checked)">
            </td>
            <td>${r.birthDate || '—'}</td>
            <td><strong>${r.name || 'Unbekannt'}</strong></td>
            <td>${r.email || '—'}</td>
            <td onclick="event.stopPropagation()">
                <button class="btn-delete-icon" onclick="deleteResume('${r._id}')" title="Löschen">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function deleteResume(id) {
    if (confirm("Möchten Sie diesen Bewerber wirklich dauerhaft löschen?")) {
        try {
            await fetch(`/resumes/${id}`, { method: 'DELETE' });
            loadDatabase(); 
        } catch (e) { alert("Fehler beim Löschen."); }
    }
}

document.getElementById('editForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const dataObj = {
        name: document.getElementById('inName').value,
        birthDate: document.getElementById('inBirthDate').value,
        email: document.getElementById('inEmail').value,
        phone: document.getElementById('inPhone').value,
        address: document.getElementById('inAddress').value,
        experience: document.getElementById('inExperience').value 
    };

    const payload = {
        encryptedData: encrypt(dataObj),
        name: "Verschlüsselter Eintrag"
    };

    const id = document.getElementById('editId').value;
    await fetch(id ? `/resumes/${id}` : '/resumes/manual', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    document.getElementById('resultSection').classList.add('hidden');
    loadDatabase();
});

// NEU: JSON Import Logik
function importJSON() {
    const jsonText = document.getElementById('jsonImportArea').value;
    if (!jsonText) return alert("Bitte JSON-Text einfügen.");
    
    try {
        const parsedData = JSON.parse(jsonText);
        fillForm(parsedData);
        document.getElementById('jsonImportArea').value = ""; 
    } catch (e) {
        alert("Fehler: Das ist kein gültiges JSON-Format.");
        console.error(e);
    }
}

function fillForm(d) {
    document.getElementById('resultSection').classList.remove('hidden');
    document.getElementById('editId').value = d._id || "";
    document.getElementById('inName').value = d.name || "";
    document.getElementById('inBirthDate').value = d.birthDate || "";
    document.getElementById('inEmail').value = d.email || "";
    document.getElementById('inPhone').value = d.phone || "";
    document.getElementById('inAddress').value = d.address || "";
    
    let expText = "";
    if (Array.isArray(d.experience)) {
        expText = d.experience.map(item => {
            if (typeof item === 'object' && item !== null) {
                return Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(' | ');
            }
            return String(item);
        }).join('\n\n');
    } else {
        expText = d.experience || "";
    }
    
    document.getElementById('inExperience').value = expText;
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
}

function showDetails(i) { 
    if (allResumes[i].secure) fillForm(allResumes[i]); 
    else alert("Zugriff verweigert: Falsches Passwort oder beschädigte Daten."); 
}

function prepareManualEntry() {
    fillForm({});
    document.getElementById('formTitle').innerText = "Neuen Bewerber erfassen";
}

async function toggleReadStatus(id, isRead) { 
    await fetch(`/resumes/${id}`, { 
        method: 'PATCH', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ isRead }) 
    });
    loadDatabase();
}

// Enter-Taste im Login-Feld
document.getElementById('masterPassword').addEventListener('keypress', (e) => { 
    if(e.key === 'Enter') unlockVault(); 
});

// Passwort anzeigen / verbergen
document.getElementById('togglePassword').addEventListener('click', function() {
    const pwInput = document.getElementById('masterPassword');
    if (pwInput.type === 'password') {
        pwInput.type = 'text';
        this.textContent = '🙈';
        this.title = 'Passwort verbergen';
    } else {
        pwInput.type = 'password';
        this.textContent = '👁️';
        this.title = 'Passwort anzeigen';
    }
});
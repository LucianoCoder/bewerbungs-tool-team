let vaultKey = ""; 
let allResumes = [];
let currentApplicantIndex = -1; 

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
            <td class="num-cell">${i + 1}</td> <td>${r.birthDate || '—'}</td>
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
            document.getElementById('viewSection').classList.add('hidden');
            document.getElementById('resultSection').classList.add('hidden');
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
        experience: document.getElementById('inExperience').value,
        commentGreg: document.getElementById('inCommentGreg').value,
        commentDario: document.getElementById('inCommentDario').value,
        commentLuci: document.getElementById('inCommentLuci').value,
        commentMarcel: document.getElementById('inCommentMarcel').value
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

function importJSON() {
    const jsonText = document.getElementById('jsonImportArea').value;
    if (!jsonText) return alert("Bitte JSON-Text einfügen.");
    
    try {
        const parsedData = JSON.parse(jsonText);
        document.getElementById('viewSection').classList.add('hidden'); 
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

    document.getElementById('inCommentGreg').value = d.commentGreg || "";
    document.getElementById('inCommentDario').value = d.commentDario || "";
    document.getElementById('inCommentLuci').value = d.commentLuci || "";
    document.getElementById('inCommentMarcel').value = d.commentMarcel || "";
    
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
}

function showView(d) {
    document.getElementById('resultSection').classList.add('hidden');
    document.getElementById('viewSection').classList.remove('hidden');
    
    document.getElementById('viewName').innerText = d.name || "Unbekannt";
    document.getElementById('viewBirthDate').innerText = d.birthDate || "—";
    document.getElementById('viewEmail').innerText = d.email || "—";
    document.getElementById('viewPhone').innerText = d.phone || "—";
    document.getElementById('viewAddress').innerText = d.address || "—";
    
    let expText = d.experience || "Keine Angaben";
    if (Array.isArray(d.experience)) {
        expText = d.experience.map(item => typeof item === 'object' ? JSON.stringify(item) : item).join('\n\n');
    }
    document.getElementById('viewExperience').innerText = expText;

    document.getElementById('viewCommentGreg').innerText = d.commentGreg || "Noch kein Kommentar";
    document.getElementById('viewCommentDario').innerText = d.commentDario || "Noch kein Kommentar";
    document.getElementById('viewCommentLuci').innerText = d.commentLuci || "Noch kein Kommentar";
    document.getElementById('viewCommentMarcel').innerText = d.commentMarcel || "Noch kein Kommentar";

    ['Greg', 'Dario', 'Luci', 'Marcel'].forEach(name => {
        const el = document.getElementById(`viewComment${name}`);
        el.style.color = d[`comment${name}`] ? '#333' : '#9aa0a6';
        el.style.fontStyle = d[`comment${name}`] ? 'normal' : 'italic';
    });

    document.getElementById('viewSection').scrollIntoView({ behavior: 'smooth' });
}

function showDetails(i) { 
    if (allResumes[i].secure) {
        currentApplicantIndex = i;
        showView(allResumes[i]);
    } else {
        alert("Zugriff verweigert: Falsches Passwort oder beschädigte Daten."); 
    }
}

function openEditMode() {
    if (currentApplicantIndex > -1) {
        document.getElementById('viewSection').classList.add('hidden');
        fillForm(allResumes[currentApplicantIndex]);
    }
}

function prepareManualEntry() {
    currentApplicantIndex = -1;
    document.getElementById('viewSection').classList.add('hidden');
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

document.getElementById('masterPassword').addEventListener('keypress', (e) => { 
    if(e.key === 'Enter') unlockVault(); 
});

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
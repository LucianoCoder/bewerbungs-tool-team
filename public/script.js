let vaultKey = ""; 
let allResumes = [];
let currentApplicantIndex = -1; 
let currentSort = 'newest';

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
    allResumes = rawData.map((item, index) => {
        if (item.encryptedData) {
            const dec = decrypt(item.encryptedData);
            return dec ? { ...item, ...dec, secure: true, originalIndex: index } : { ...item, name: "🔒 Gesperrt", email: "🔒 Gesperrt", birthDate: "🔒 Gesperrt", secure: false, originalIndex: index };
        }
        return { ...item, secure: true, old: true, originalIndex: index };
    });

    applyFilters();
}

// --- FILTER & SORTIERUNG ---
function setSort(type) {
    currentSort = type;
    applyFilters();
}

function clearSearchField() {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = "";
    applyFilters();
}

function applyFilters() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    const clearBtn = document.getElementById('clearSearch');
    
    // X-Button anzeigen/ausblenden
    clearBtn.style.display = term.length > 0 ? "block" : "none";
    
    let filtered = allResumes.filter(r => r.name && r.name.toLowerCase().includes(term));
    
    // Spezialfilter: Unvollständige Bewertungen
    if (currentSort === 'incomplete') {
        filtered = filtered.filter(r => {
            return !r.ratingGreg || !r.ratingDario || !r.ratingLuci || !r.ratingMarcel;
        });
    }

    // Sortierung
    if (currentSort === 'asc') {
        filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (currentSort === 'desc') {
        filtered.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    } else if (currentSort === 'oldest') {
        filtered.sort((a, b) => {
            const timeA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
            const timeB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
            return timeA === timeB ? a.originalIndex - b.originalIndex : timeA - timeB;
        });
    } else {
        // Neueste zuerst (Standard auch bei 'incomplete')
        filtered.sort((a, b) => {
            const timeA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
            const timeB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
            return timeA === timeB ? b.originalIndex - a.originalIndex : timeB - timeA;
        });
    }

    drawTable(filtered);
}

function drawTable(dataToDraw) {
    const tbody = document.getElementById('savedResumesBody');
    const counterEl = document.getElementById('candidateCounter');
    
    counterEl.innerText = dataToDraw.length + (dataToDraw.length === 1 ? " Bewerber" : " Bewerber");
    
    tbody.innerHTML = dataToDraw.map((r) => `
        <tr class="clickable-row" onclick="showDetails(${r.originalIndex})">
            <td class="checkbox-cell" onclick="event.stopPropagation()">
                <input type="checkbox" ${r.isRead ? 'checked' : ''} onchange="toggleReadStatus('${r._id}', this.checked)">
            </td>
            <td>
                <div class="ratings-stack">
                    <div class="rating-mini ${r.ratingGreg || 'none'}">G: ${r.ratingGreg || '-'}</div>
                    <div class="rating-mini ${r.ratingDario || 'none'}">D: ${r.ratingDario || '-'}</div>
                    <div class="rating-mini ${r.ratingLuci || 'none'}">L: ${r.ratingLuci || '-'}</div>
                    <div class="rating-mini ${r.ratingMarcel || 'none'}">M: ${r.ratingMarcel || '-'}</div>
                </div>
            </td>
            <td>${r.birthDate || '—'}</td>
            <td><strong>${r.name || 'Unbekannt'}</strong></td>
            <td>${r.email || '—'}</td>
            <td style="text-align: center; padding-right: 20px;" onclick="event.stopPropagation()">
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
        ratingGreg: document.getElementById('inRatingGreg').value,
        
        commentDario: document.getElementById('inCommentDario').value,
        ratingDario: document.getElementById('inRatingDario').value,
        
        commentLuci: document.getElementById('inCommentLuci').value,
        ratingLuci: document.getElementById('inRatingLuci').value,
        
        commentMarcel: document.getElementById('inCommentMarcel').value,
        ratingMarcel: document.getElementById('inRatingMarcel').value
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
    document.getElementById('inRatingGreg').value = d.ratingGreg || "";
    
    document.getElementById('inCommentDario').value = d.commentDario || "";
    document.getElementById('inRatingDario').value = d.ratingDario || "";
    
    document.getElementById('inCommentLuci').value = d.commentLuci || "";
    document.getElementById('inRatingLuci').value = d.ratingLuci || "";
    
    document.getElementById('inCommentMarcel').value = d.commentMarcel || "";
    document.getElementById('inRatingMarcel').value = d.ratingMarcel || "";
    
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
    document.getElementById('viewRatingGreg').innerText = d.ratingGreg ? `(${d.ratingGreg})` : "";
    
    document.getElementById('viewCommentDario').innerText = d.commentDario || "Noch kein Kommentar";
    document.getElementById('viewRatingDario').innerText = d.ratingDario ? `(${d.ratingDario})` : "";
    
    document.getElementById('viewCommentLuci').innerText = d.commentLuci || "Noch kein Kommentar";
    document.getElementById('viewRatingLuci').innerText = d.ratingLuci ? `(${d.ratingLuci})` : "";
    
    document.getElementById('viewCommentMarcel').innerText = d.commentMarcel || "Noch kein Kommentar";
    document.getElementById('viewRatingMarcel').innerText = d.ratingMarcel ? `(${d.ratingMarcel})` : "";

    ['Greg', 'Dario', 'Luci', 'Marcel'].forEach(name => {
        const el = document.getElementById(`viewComment${name}`);
        const badge = document.getElementById(`viewRating${name}`);
        
        el.style.color = d[`comment${name}`] ? '#333' : '#9aa0a6';
        el.style.fontStyle = d[`comment${name}`] ? 'normal' : 'italic';
        
        badge.style.color = 'white';
        if(d[`rating${name}`] === 'A') badge.style.backgroundColor = '#34a853';
        else if(d[`rating${name}`] === 'B') badge.style.backgroundColor = '#fbbc05';
        else if(d[`rating${name}`] === 'C') badge.style.backgroundColor = '#ea4335';
        else badge.style.backgroundColor = 'transparent';
    });

    document.getElementById('viewSection').scrollIntoView({ behavior: 'smooth' });
}

function showDetails(originalIndex) { 
    if (allResumes[originalIndex].secure) {
        currentApplicantIndex = originalIndex;
        showView(allResumes[originalIndex]);
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

function exportExcelFull() {
    const dataForExcel = allResumes
        .filter(r => r.secure && r.name !== "🔒 Gesperrt")
        .map(r => {
            return {
                "Name": r.name,
                "Geburtsdatum": r.birthDate || "",
                "E-Mail": r.email || "",
                "Telefon": r.phone || "",
                "Adresse": r.address || "",
                "Bewertung Greg": r.ratingGreg || "",
                "Kommentar Greg": r.commentGreg || "",
                "Bewertung Dario": r.ratingDario || "",
                "Kommentar Dario": r.commentDario || "",
                "Bewertung Luci": r.ratingLuci || "",
                "Kommentar Luci": r.commentLuci || "",
                "Bewertung Marcel": r.ratingMarcel || "",
                "Kommentar Marcel": r.commentMarcel || ""
            };
        });

    if (dataForExcel.length === 0) return alert("Keine Daten zum Exportieren vorhanden.");

    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    
    const colWidths = [];
    const keys = Object.keys(dataForExcel[0] || {});
    
    keys.forEach(key => {
        let maxWidth = key.length; 
        dataForExcel.forEach(row => {
            const cellValue = row[key] ? String(row[key]) : "";
            const lines = cellValue.split('\n'); 
            lines.forEach(line => {
                if (line.length > maxWidth) {
                    maxWidth = line.length;
                }
            });
        });
        colWidths.push({ wch: Math.min(maxWidth + 2, 60) }); 
    });
    
    worksheet['!cols'] = colWidths; 

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bewerber_Komplett");
    XLSX.writeFile(workbook, "Bewerber_Datenbank.xlsx");
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
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = path.join(__dirname, 'Aashika_Bhaweneshwor Stock Book.xlsx');

const workbook = xlsx.readFile(excelPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet);

// Find matching image file for each product
const allFiles = fs.readdirSync(__dirname);
const imageFiles = allFiles.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));

function normalize(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const products = rows.map((row, index) => {
    const name = row['Product'];
    const volume = row['Quantaty per bottle'];
    const piecesPerCase = row['Quantaty Per Case'];
    const fullName = `${name} ${volume}`;
    const normFull = normalize(fullName);

    let imageFile = null;
    for (const file of imageFiles) {
        const ext = path.extname(file);
        const base = path.basename(file, ext);
        if (normalize(base) === normFull) {
            imageFile = file;
            break;
        }
    }

    // Random initial stock for testing
    const stockCases = Math.floor(Math.random() * 25) + 1;  // 1-25 cases
    const stockPieces = Math.floor(Math.random() * piecesPerCase); // 0 to piecesPerCase-1

    return {
        id: `prod_${index + 1}`,
        name: name,
        volume: volume,
        piecesPerCase: piecesPerCase,
        image: imageFile || '',
        initialStockCases: stockCases,
        initialStockPieces: stockPieces
    };
});

const output = `// Auto-generated product catalog from Excel
// Generated: ${new Date().toISOString()}
const PRODUCT_CATALOG = ${JSON.stringify(products, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, 'data.js'), output, 'utf-8');
console.log(`Generated data.js with ${products.length} products.`);
products.forEach(p => {
    console.log(`  ${p.name} ${p.volume} -> ${p.image || 'NO IMAGE'} | Stock: ${p.initialStockCases} cases + ${p.initialStockPieces} pcs`);
});

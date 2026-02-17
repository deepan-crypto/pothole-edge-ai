
const assert = require('assert');

function sanitizeURI(uri) {
    let mongoURI = uri;
    console.log(`Original: '${mongoURI}'`);

    if (mongoURI && mongoURI.endsWith('?appName')) {
        console.log('Fixing MongoDB URI: Removing empty appName parameter');
        mongoURI = mongoURI.slice(0, -8);
    }

    if (mongoURI && mongoURI.endsWith('?appName=')) {
        console.log('Fixing MongoDB URI: Removing empty appName parameter');
        mongoURI = mongoURI.slice(0, -9);
    }

    console.log(`Sanitized: '${mongoURI}'`);
    return mongoURI;
}

// Test cases
try {
    const uri1 = "mongodb+srv://user:pass@cluster.mongodb.net/?appName";
    const result1 = sanitizeURI(uri1);
    assert.strictEqual(result1, "mongodb+srv://user:pass@cluster.mongodb.net/");
    console.log("Test 1 Passed: ?appName removed");

    const uri2 = "mongodb+srv://user:pass@cluster.mongodb.net/?appName=";
    const result2 = sanitizeURI(uri2);
    assert.strictEqual(result2, "mongodb+srv://user:pass@cluster.mongodb.net/");
    console.log("Test 2 Passed: ?appName= removed");

    const uri3 = "mongodb+srv://user:pass@cluster.mongodb.net/dbname";
    const result3 = sanitizeURI(uri3);
    assert.strictEqual(result3, "mongodb+srv://user:pass@cluster.mongodb.net/dbname");
    console.log("Test 3 Passed: Normal URI unchanged");

    console.log("\nAll verification tests passed!");
} catch (e) {
    console.error("Verification Failed:", e.message);
    process.exit(1);
}

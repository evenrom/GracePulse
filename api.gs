// api.gs
// GracePulse PWA Backend (Google Apps Script) - API Layer

function buildJsonResponse(payload) {
  const output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// Preflight CORS request handler
function doOptions(e) {
  return buildJsonResponse({ status: 'ok' });
}

// GET Request handler
function doGet(e) {
  const action = e.parameter.action;

  try {
    if (action === 'getState') {
      return buildJsonResponse(getState());
    } else {
      return buildJsonResponse({ error: 'Invalid action or missing action parameter' });
    }
  } catch (error) {
    return buildJsonResponse({ error: error.toString() });
  }
}

// POST Request handler
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    // Sanitization and Routing Layer
    switch(action) {
      case 'lockMonth':
        const monthLock = String(postData.month || '');
        if (!monthLock) throw new Error("Missing 'month' parameter.");
        return buildJsonResponse(lockMonth(monthLock));

      case 'updateInflows':
        const monthUpdate = String(postData.month || '');
        const rom = parseFloat(postData.rom) || 0;
        const yael = parseFloat(postData.yael) || 0;
        const deposit = parseFloat(postData.deposit) || 0;
        if (!monthUpdate) throw new Error("Missing 'month' parameter.");
        return buildJsonResponse(updateInflows(monthUpdate, rom, yael, deposit));

      case 'addPrimeRate':
        const datePrime = String(postData.date || '');
        const rate = parseFloat(postData.rate);
        if (!datePrime || isNaN(rate)) throw new Error("Missing or invalid 'date' or 'rate' parameters.");
        return buildJsonResponse(addPrimeRate(datePrime, rate));

      case 'addConstructionIndex':
        const dateIndex = String(postData.date || '');
        const indexValue = parseFloat(postData.indexValue);
        if (!dateIndex || isNaN(indexValue)) throw new Error("Missing or invalid 'date' or 'indexValue' parameters.");
        return buildJsonResponse(addConstructionIndex(dateIndex, indexValue));

      case 'approveIndexLinkage':
        const dateLinkage = String(postData.date || '');
        const amount = parseFloat(postData.amount);
        if (!dateLinkage || isNaN(amount)) throw new Error("Missing or invalid 'date' or 'amount' parameters.");
        return buildJsonResponse(appendIndexLinkage(dateLinkage, amount));

      default:
        return buildJsonResponse({ error: 'Invalid action' });
    }
  } catch (error) {
    return buildJsonResponse({ error: error.toString() });
  }
}

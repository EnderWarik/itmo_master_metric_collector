const WEBHOOK_URL = 'https://<domain>/rest/<user_id>/<webhook_secret>/crm.lead.add.json';

const data = {
  fields: {
    TITLE: 'Тестовая заявка с формы Демо-версия',
    PHONE: [
      {
        VALUE: '+79991234567',
        VALUE_TYPE: 'WORK',
      },
    ],
    EMAIL: [
      {
        VALUE: 'test@example.com',
        VALUE_TYPE: 'WORK',
      },
    ],
    UTM_SOURCE: 'google',
    UTM_MEDIUM: 'cpc',
    UTM_CAMPAIGN: 'demo_campaign',
    UTM_CONTENT: 'banner_1',
    UTM_TERM: 'crm',
    COMMENTS: 'Тестовая заявка\nФорма: Демо-версия\nСайт: mservice.group',
  },
};

async function createLead() {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createLead();

// Import Firebase export JSON and insert into Realm using dbServicesLocal
import fs from 'fs';
import path from 'path';
import {
  importLegacyDiscussions,
  importLegacyActivityLogs,
} from '../services/dbServicesLocal';

// Path to your exported Firebase data
const DATA_PATH = path.join(__dirname, '../../firebase_export.json');

async function importData() {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  const data = JSON.parse(raw);

  // Import Discussions
  if (data.discussions && Array.isArray(data.discussions)) {
    await importLegacyDiscussions(data.discussions);
    console.log(`Imported ${data.discussions.length} discussions.`);
  }

  // Import ActivityLogs
  if (data.activityLogs && Array.isArray(data.activityLogs)) {
    await importLegacyActivityLogs(data.activityLogs);
    console.log(`Imported ${data.activityLogs.length} activity logs.`);
  }

  if (!data.discussions && !data.activityLogs) {
    console.log('No legacy data to import.');
  }
}

importData().catch((err) => {
  console.error('Import failed:', err);
});

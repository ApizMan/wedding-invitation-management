import 'dotenv/config';
import { auth, db } from '../database/firebase';

interface AdminAccount {
  email: string;
  password: string;
  displayName: string;
}

const ADMINS: AdminAccount[] = [
  { email: 'admin@kadjemputan.com', password: 'N@fiz123', displayName: 'Admin KadJemputan' },
];

async function upsertAdminUserDoc(uid: string, email: string, displayName: string) {
  await db.collection('users').doc(uid).set({
    uid,
    email,
    name: displayName,
    role: 'admin',
    createdAt: new Date().toISOString(),
  }, { merge: true });
}

async function run() {
  for (const admin of ADMINS) {
    try {
      const existing = await auth.getUserByEmail(admin.email).catch(() => null);
      if (existing) {
        console.log(`Sudah wujud, skip: ${admin.email}`);
        await upsertAdminUserDoc(existing.uid, admin.email, admin.displayName);
        continue;
      }
      const user = await auth.createUser({
        email: admin.email,
        password: admin.password,
        displayName: admin.displayName,
      });
      await upsertAdminUserDoc(user.uid, admin.email, admin.displayName);
      console.log(`Berjaya dicipta: ${admin.email} (uid: ${user.uid})`);
    } catch (err: any) {
      console.error(`Gagal cipta ${admin.email}:`, err.message);
    }
  }
  process.exit(0);
}

run();

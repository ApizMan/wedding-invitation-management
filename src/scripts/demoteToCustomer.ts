import 'dotenv/config';
import { auth, db } from '../database/firebase';

// Converts existing admin accounts into regular customer accounts (e.g. once a dedicated
// admin login has been created and the personal emails should become customer-facing).
const EMAILS_TO_DEMOTE: string[] = [
  'nafizmansor@gmail.com',
  'atiqahzukapeli@gmail.com',
];

async function run() {
  for (const email of EMAILS_TO_DEMOTE) {
    try {
      const user = await auth.getUserByEmail(email).catch(() => null);
      if (!user) {
        console.log(`Tidak dijumpai di Firebase Auth, skip: ${email}`);
        continue;
      }
      await db.collection('users').doc(user.uid).set({
        uid: user.uid,
        email,
        name: user.displayName || email,
        role: 'customer',
        createdAt: new Date().toISOString(),
      }, { merge: true });
      console.log(`Ditukar kepada customer: ${email} (uid: ${user.uid})`);
    } catch (err: any) {
      console.error(`Gagal menukar ${email}:`, err.message);
    }
  }
  process.exit(0);
}

run();

import 'dotenv/config';
import { auth } from '../database/firebase';

interface AdminAccount {
  email: string;
  password: string;
  displayName: string;
}

const ADMINS: AdminAccount[] = [
  { email: 'nafizmansor@gmail.com', password: 'NafizAtiqah123', displayName: 'Muhammad Nafiz' },
  { email: 'atiqahzukapeli@gmail.com', password: 'NafizAtiqah123', displayName: 'Nur Atiqah' },
];

async function run() {
  for (const admin of ADMINS) {
    try {
      const existing = await auth.getUserByEmail(admin.email).catch(() => null);
      if (existing) {
        console.log(`Sudah wujud, skip: ${admin.email}`);
        continue;
      }
      const user = await auth.createUser({
        email: admin.email,
        password: admin.password,
        displayName: admin.displayName,
      });
      console.log(`Berjaya dicipta: ${admin.email} (uid: ${user.uid})`);
    } catch (err: any) {
      console.error(`Gagal cipta ${admin.email}:`, err.message);
    }
  }
  process.exit(0);
}

run();

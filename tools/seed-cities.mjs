import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const IBGE_CITIES_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/41/municipios';
const EXPECTED_CITY_COUNT = 399;

const projectId = process.env.FIREBASE_PROJECT_ID;
const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);

const response = await fetch(IBGE_CITIES_URL);
if (!response.ok) {
  throw new Error(`O IBGE respondeu com status ${response.status}.`);
}

const municipalities = await response.json();
if (!Array.isArray(municipalities) || municipalities.length !== EXPECTED_CITY_COUNT) {
  throw new Error(
    `O IBGE deveria retornar ${EXPECTED_CITY_COUNT} municípios, mas retornou ${municipalities.length}.`,
  );
}

const refs = municipalities.map((city) => db.collection('cities').doc(String(city.id)));
const currentDocuments = await db.getAll(...refs);
const existingIds = new Set(currentDocuments.filter((entry) => entry.exists).map((entry) => entry.id));

for (let start = 0; start < municipalities.length; start += 400) {
  const batch = db.batch();
  const slice = municipalities.slice(start, start + 400);

  for (const city of slice) {
    const ibgeCode = String(city.id);
    const payload = {
      ibgeCode,
      name: city.nome,
      state: 'PR',
      region: city['regiao-imediata']?.nome ?? city.microrregiao?.nome ?? 'Paraná',
      updatedAt: FieldValue.serverTimestamp(),
      source: 'IBGE Localidades',
      ...(!existingIds.has(ibgeCode) ? { info: '' } : {}),
    };

    batch.set(db.collection('cities').doc(ibgeCode), payload, { merge: true });
  }

  await batch.commit();
}

console.log(`${municipalities.length} municípios do Paraná gravados no Firestore.`);

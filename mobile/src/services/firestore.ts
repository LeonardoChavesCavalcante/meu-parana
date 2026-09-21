import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';

import { db } from '../config/firebase';
import type { City, MapShare, SharePermission, Visit } from '../types';

export function subscribeToCities(
  onValue: (cities: City[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'cities'), orderBy('name')),
    (snapshot) => {
      onValue(snapshot.docs.map((entry) => entry.data() as City));
    },
    onError,
  );
}

export function subscribeToVisits(
  userId: string,
  onValue: (visits: Map<string, Visit>) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', userId, 'visits'),
    (snapshot) => {
      const visits = new Map<string, Visit>();
      for (const entry of snapshot.docs) {
        const data = entry.data();
        visits.set(entry.id, {
          cityId: entry.id,
          cityName: String(data.cityName ?? ''),
          visitedDate: String(data.visitedDate ?? ''),
          userInfo: String(data.userInfo ?? ''),
          updatedAt: data.updatedAt?.toDate?.() ?? null,
        });
      }
      onValue(visits);
    },
    onError,
  );
}

export async function saveCityVisit(
  userId: string,
  city: City,
  visit: Pick<Visit, 'visitedDate' | 'userInfo'>,
) {
  const visitRef = doc(db, 'users', userId, 'visits', city.ibgeCode);
  await setDoc(visitRef, {
    cityId: city.ibgeCode,
    cityName: city.name,
    visitedDate: visit.visitedDate,
    userInfo: visit.userInfo.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCityVisit(userId: string, cityId: string) {
  await deleteDoc(doc(db, 'users', userId, 'visits', cityId));
}

function mapShareFromData(code: string, data: Record<string, unknown>): MapShare {
  return {
    code,
    ownerId: String(data.ownerId ?? ''),
    ownerName: String(data.ownerName ?? 'Outro usuário'),
    permission: data.permission === 'edit' ? 'edit' : 'read',
  };
}

export function normalizeShareCode(value: string) {
  const match = /[?&]share=([^&#]+)/i.exec(value);
  const rawCode = match ? decodeURIComponent(match[1]) : value;
  return rawCode.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

export async function getMapShare(value: string) {
  const code = normalizeShareCode(value);
  if (!code) throw new Error('Código de compartilhamento inválido.');
  const snapshot = await getDoc(doc(db, 'mapShares', code));
  if (!snapshot.exists()) throw new Error('Compartilhamento não encontrado ou encerrado.');
  return mapShareFromData(snapshot.id, snapshot.data());
}

export function subscribeToMapShare(
  code: string,
  onValue: (share: MapShare | null) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'mapShares', code),
    (snapshot) => onValue(snapshot.exists() ? mapShareFromData(snapshot.id, snapshot.data()) : null),
    onError,
  );
}

export function subscribeToOwnedShare(
  userId: string,
  onValue: (share: MapShare | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  let stopShare: Unsubscribe | undefined;
  const stopProfile = onSnapshot(
    doc(db, 'users', userId),
    (profileSnapshot) => {
      stopShare?.();
      stopShare = undefined;
      const code = String(profileSnapshot.data()?.shareCode ?? '');
      if (!code) {
        onValue(null);
        return;
      }
      stopShare = onSnapshot(
        doc(db, 'mapShares', code),
        (shareSnapshot) => {
          onValue(shareSnapshot.exists() ? mapShareFromData(code, shareSnapshot.data()) : null);
        },
        onError,
      );
    },
    onError,
  );

  return () => {
    stopShare?.();
    stopProfile();
  };
}

export async function saveMapShare(
  user: User,
  permission: SharePermission,
  currentCode?: string,
) {
  const code = currentCode || doc(collection(db, 'mapShares')).id.toUpperCase().slice(0, 12);
  const batch = writeBatch(db);
  batch.set(doc(db, 'mapShares', code), {
    code,
    ownerId: user.uid,
    ownerName: user.displayName || user.email || 'Outro usuário',
    permission,
    updatedAt: serverTimestamp(),
    ...(currentCode ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true });
  batch.set(doc(db, 'users', user.uid), {
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    photoURL: user.photoURL ?? '',
    lastLoginAt: serverTimestamp(),
    shareCode: code,
  }, { merge: true });
  await batch.commit();
  return code;
}

export async function stopMapShare(userId: string, code: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'mapShares', code));
  batch.update(doc(db, 'users', userId), { shareCode: deleteField() });
  await batch.commit();
}

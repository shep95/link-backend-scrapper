import type { Db } from "@ghostchain/storage";
import { acknowledgeNotification, listNotifications } from "@ghostchain/storage";

export function getNotifications(db: Db) {
  return listNotifications(db);
}

export function ackNotification(db: Db, id: string, by: string): boolean {
  return acknowledgeNotification(db, id, by);
}

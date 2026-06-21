import type { Db } from "@ghostchain/storage";
import { acknowledgeNotification, listNotifications } from "@ghostchain/storage";

export function getNotifications(db: Db) {
  return listNotifications(db);
}

export function ackNotification(db: Db, id: string, by: string): boolean {
  acknowledgeNotification(db, id, by);
  return true;
}

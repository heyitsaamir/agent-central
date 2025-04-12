export interface User {
  id: string;
  name: string;
}

export interface StandupResponse {
  userId: string;
  completedWork: string;
  plannedWork: string;
  parkingLot?: string;
  timestamp: Date;
}

export type Success<T> = {
  type: "success";
  data: T;
  message: string;
};

export type Error = {
  type: "error";
  message: string;
};

export type Result<T> = Success<T> | Error;

export interface StandupSummary {
  date: Date;
  participants: User[];
  responses: StandupResponse[];
  parkingLot?: string[];
}

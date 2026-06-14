export type RaceStatus = "waiting" | "countdown" | "racing" | "finished";

export interface Player {
  userId:     string;
  username:   string;
  name:       string;
  image:      string | null;
  socketId:   string;
  progress:   number;
  wpm:        number;
  accuracy:   number;
  finished:   boolean;
  finishTime: number | null;
  rank:       number | null;
}

export interface RaceRoom {
  code:         string;
  hostId:       string;
  passageId:    string | null;
  passageText:  string;
  status:       RaceStatus;
  players:      Record<string, Player>;
  maxPlayers:   number;
  startedAt:    number | null;
  finishedAt:   number | null;
  countdownEnd: number | null;
  finishOrder:  string[];
}

export interface Standing {
  rank:     number;
  userId:   string;
  wpm:      number;
  accuracy: number;
  name:     string;
  username: string;
  image:    string | null;
}

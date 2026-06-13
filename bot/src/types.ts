export type AxonesEntityType =
  | "work_order"
  | "material"
  | "alert"
  | "material_request"
  | "area_request"
  | "client_order"
  | "delivery_note"
  | "bobina";

export interface AxonesDot {
  type: AxonesEntityType | string;
  id: string | number;
  label: string;
  href: string;
}

export interface AxonesChip {
  label: string;
  tool: string;
  params?: Record<string, unknown>;
}

export interface AxonesToolResult<T = unknown> {
  ok: boolean;
  summary?: string;
  data?: T;
  dots?: AxonesDot[];
  follow_up_chips?: AxonesChip[];
  error?: string;
}

export class AxonesApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "AxonesApiError";
    this.status = status;
    this.body = body;
  }
}

export type PlatformRole = "admin_master";
export type TenantRole = "owner" | "manager" | "operator";
export type OperationBoxKind = "entry" | "wash" | "dry" | "finish" | "ready";
export type TenantOperationalProfile = "automotive" | "generic";
export type AttendanceMediaKind = "entry" | "step" | "ready" | "damage_note" | "marketing";
export type InventoryMovementKind = "initial" | "in" | "out";
export type TenantGrowthProgressRecord = {
  id: string;
  tenant_id: string;
  step_key: string;
  notes: string | null;
  completed: boolean;
  completed_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRecord = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

export type TenantRecord = {
  id: string;
  name: string;
  slug: string | null;
  whatsapp: string | null;
  operational_profile: TenantOperationalProfile;
  is_active: boolean;
  created_at?: string;
  created_by?: string | null;
};

export type MembershipRecord = {
  tenant_id: string;
  role: TenantRole;
  tenants: TenantRecord | null;
};

export type ServiceRecord = {
  id: string;
  tenant_id: string;
  name: string;
  base_service_id: string | null;
  time_unit: "minutes" | "hours_minutes" | "days" | "weeks" | "months";
  price: number;
  price_passeio: number;
  price_medio: number;
  price_grande: number;
  price_bem_grande: number;
  price_app_passeio: number;
  price_app_medio: number;
  price_app_grande: number;
  price_app_bem_grande: number;
  minutes_passeio: number;
  minutes_medio: number;
  minutes_grande: number;
  minutes_bem_grande: number;
  addon_minutes: number;
  addon_minutes_passeio: number;
  addon_minutes_medio: number;
  addon_minutes_grande: number;
  addon_minutes_bem_grande: number;
  addon_price_passeio: number;
  addon_price_medio: number;
  addon_price_grande: number;
  addon_price_bem_grande: number;
  addon_price_app_passeio: number;
  addon_price_app_medio: number;
  addon_price_app_grande: number;
  addon_price_app_bem_grande: number;
  average_minutes: number;
  short_description: string | null;
  kind: "main" | "extra";
  is_active: boolean;
  base_service?: { name: string } | null;
};

export type CustomerRecord = {
  id: string;
  tenant_id: string;
  name: string;
  whatsapp: string | null;
  phone_normalized?: string | null;
  legal_name?: string | null;
  trade_name?: string | null;
  email?: string | null;
  document?: string | null;
  document_type?: "cpf" | "cnpj" | null;
  state_registration?: string | null;
  municipal_registration?: string | null;
  postal_code?: string | null;
  street?: string | null;
  street_number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  contact_phone_1?: string | null;
  contact_phone_2?: string | null;
  is_fleet?: boolean;
  is_active: boolean;
  last_return_reminder_sent_at?: string | null;
};

export type VehicleRecord = {
  id: string;
  tenant_id: string;
  customer_id: string;
  plate: string;
  brand: string | null;
  model: string;
  color: string | null;
  vehicle_type: string | null;
  usage_type: VehicleUsageType;
  size_tier: VehicleSizeTier | null;
  tier_source: VehicleTierSource | null;
  vehicle_source: VehicleSource;
  confirmed_at: string | null;
  last_vehicle_data_at: string | null;
  is_active: boolean;
};

export type AttendanceServiceItemRecord = {
  id: string;
  tenant_id: string;
  attendance_id: string;
  service_id: string | null;
  name: string;
  estimated_minutes: number | null;
  unit_price: number;
  status: "pending" | "completed" | "canceled";
  sort_order: number;
  is_primary: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceRecord = {
  id: string;
  tenant_id: string;
  customer_id: string;
  vehicle_id: string;
  service_id: string | null;
  service_label?: string | null;
  service_summary?: string | null;
  employee_id: string | null;
  status: "waiting" | "washing" | "finishing" | "ready" | "delivered" | "canceled";
  estimated_minutes: number | null;
  extra_minutes?: number | null;
  current_box_id?: string | null;
  current_box_entered_at?: string | null;
  queue_position?: number | null;
  operational_stage?: string | null;
  final_price: number;
  payment_method: "cash" | "pix" | "card" | "pending";
  billing_mode?: "standard" | "fleet";
  billing_due_date?: string | null;
  public_code: string;
  idempotency_key?: string | null;
  source?: "operator" | "portal" | "appointment";
  payment_intent_id?: string | null;
  started_at?: string | null;
  ready_at?: string | null;
  created_at: string;
  customers?: { name: string; whatsapp?: string | null } | null;
  vehicles?: { plate: string; brand?: string | null; model: string; color: string | null; vehicle_type?: string | null } | null;
  services?: { name: string } | null;
  service_items?: AttendanceServiceItemRecord[];
  employees?: { name: string } | null;
  media?: AttendanceMediaRecord[];
};

export type MessageDispatchQueueRecord = {
  id: string;
  tenant_id: string;
  attendance_id: string | null;
  customer_id: string | null;
  stage: "queue" | "washing" | "finishing" | "ready";
  whatsapp: string;
  text: string;
  media_url: string | null;
  media_mime_type: string | null;
  media_file_name: string | null;
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  last_error: string | null;
  processing_started_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OperationBoxRecord = {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  kind: OperationBoxKind;
  sort_order: number;
  sla_minutes: number | null;
  sla_unit: "minutes" | "hours_minutes" | "days" | "weeks" | "months";
  color_token: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AttendanceBoxEventRecord = {
  id: string;
  tenant_id: string;
  attendance_id: string;
  from_box_id: string | null;
  to_box_id: string | null;
  moved_by: string | null;
  moved_at: string;
  note: string | null;
};

export type AttendanceMediaRecord = {
  id: string;
  tenant_id: string;
  attendance_id: string;
  box_id: string | null;
  uploaded_by: string | null;
  kind: AttendanceMediaKind;
  file_path: string;
  mime_type: string;
  caption: string | null;
  created_at: string;
  signed_url?: string | null;
};

export type EmployeeRecord = {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email?: string | null;
  contact_phone?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  postal_code?: string | null;
  street?: string | null;
  street_number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  internal_code?: string | null;
  role_label: string;
  can_access_system: boolean;
  payment_type: "daily" | "commission" | "fixed";
  payment_value: number;
  is_active: boolean;
  is_present: boolean;
  auth_user_id: string | null;
  current_session_logged_in_at?: string | null;
};

export type EmployeeWorkSessionRecord = {
  id: string;
  tenant_id: string;
  employee_id: string;
  auth_user_id: string;
  logged_in_at: string;
  logged_out_at: string | null;
  ended_by_shift: boolean;
  created_at: string;
  washed_count?: number;
  dried_count?: number;
};

export type AppointmentRecord = {
  id: string;
  tenant_id: string;
  customer_id?: string | null;
  vehicle_id?: string | null;
  service_id?: string | null;
  scheduled_for: string;
  status: string;
  notes: string | null;
  customers?: { name: string } | null;
  vehicles?: { brand?: string | null; model: string; plate: string; color?: string | null; vehicle_type?: string | null } | null;
  services?: {
    name: string;
    price?: number | null;
    price_passeio?: number | null;
    price_medio?: number | null;
    price_grande?: number | null;
    price_bem_grande?: number | null;
  } | null;
};

export type ServiceQuoteRecord = {
  id: string;
  tenant_id: string;
  customer_id: string;
  vehicle_id: string | null;
  service_id: string;
  request_description: string;
  labor_description: string | null;
  labor_amount: number;
  parts_description: string | null;
  parts_amount: number;
  notes: string | null;
  status: "draft" | "approved" | "rejected";
  approved_attendance_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  vehicles?: { plate: string; brand?: string | null; model: string; color?: string | null; vehicle_type?: string | null } | null;
  services?: { name: string } | null;
};

export type CashSessionRecord = {
  id: string;
  tenant_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  closing_balance: number | null;
  status: string;
};

export type CashEntryRecord = {
  id: string;
  tenant_id: string;
  kind: "income" | "expense";
  payment_method: "cash" | "pix" | "card" | "pending" | null;
  description: string;
  amount: number;
  effective_date?: string;
  settlement_status?: "scheduled" | "settled" | string;
  card_kind?: "credit" | "debit" | null;
  created_at: string;
};

export type TenantSettingsRecord = {
  tenant_id: string;
  default_service_minutes: number | null;
  customer_messages_enabled: boolean;
  queue_entry_message: string | null;
  queue_entry_message_enabled: boolean;
  wash_start_message: string | null;
  wash_start_message_enabled: boolean;
  finishing_message: string | null;
  finishing_message_enabled: boolean;
  ready_message: string | null;
  ready_message_enabled: boolean;
  return_reminder_message: string | null;
  return_reminder_enabled: boolean;
  return_reminder_days: number;
  return_reminder_time: string | null;
  whatsapp_pairing_token: string | null;
  evolution_base_url: string | null;
  evolution_instance: string | null;
  evolution_api_key: string | null;
  evolution_enabled: boolean;
  operator_can_edit_status: boolean;
  operator_can_view_all_cars: boolean;
  operator_can_view_customer_phone: boolean;
  operator_inventory_enabled: boolean;
  operations_mode: "classic" | "boxes";
  operation_flow_locked: boolean;
  tv_mode_enabled: boolean;
  require_ready_photo: boolean;
  allow_step_photos: boolean;
  landing_enabled: boolean;
  instagram_enabled: boolean;
  instagram_auto_publish_enabled: boolean;
  instagram_default_publish_mode: "manual";
  logout_before: string | null;
  vehicle_type_tier_overrides?: Partial<Record<"hatch" | "sedan" | "wagon" | "pickup_small" | "suv" | "pickup_large" | "van" | "micro_bus" | "truck" | "bus", "passeio" | "medio" | "grande" | "bem_grande">>;
  payment_mode?: "order_without_online_payment" | "online_required";
  portal_payment_methods?: string[];
};

export type TenantInstagramAccountRecord = {
  id: string;
  tenant_id: string;
  instagram_account_id: string;
  facebook_page_id: string | null;
  account_name: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanRecord = {
  id: string;
  code: string;
  name: string;
  price_monthly: number;
  operator_limit: number | null;
  appointment_limit: number | null;
  whatsapp_limit: number | null;
  features: string[];
  is_active: boolean;
};

export type TenantSubscriptionRecord = {
  id: string;
  tenant_id: string;
  plan_id: string | null;
  status: "trialing" | "active" | "past_due" | "canceled" | "suspended";
  amount: number;
  billing_cycle: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  plans?: PlanRecord | null;
  tenants?: TenantRecord | null;
};

export type CommercialIntakeStatus = "submitted" | "awaiting_payment" | "paid" | "active" | "archived";
export type CommercialIntakePaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type CommercialIntakeRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  email: string;
  whatsapp: string;
  contact_phone: string | null;
  legal_name: string | null;
  trade_name: string | null;
  document: string;
  document_type: "cpf" | "cnpj";
  state_registration: string | null;
  municipal_registration: string | null;
  postal_code: string;
  street: string;
  street_number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  current_situation: string | null;
  selected_plan_code: string;
  selected_plan_name: string;
  implementation_fee: number | null;
  recurring_fee: number | null;
  contract_version: string;
  contract_title: string;
  contract_body: string;
  contract_accepted: boolean;
  contract_accepted_at: string | null;
  status: CommercialIntakeStatus;
  payment_status: CommercialIntakePaymentStatus;
  payment_confirmed_at: string | null;
  contract_email_sent_at: string | null;
  contract_email_error: string | null;
  internal_notes: string | null;
  metadata: Record<string, unknown>;
};

export type SupportTicketRecord = {
  id: string;
  tenant_id: string | null;
  subject: string;
  description: string | null;
  status: "open" | "in_progress" | "resolved";
  admin_reply: string | null;
  admin_reply_at: string | null;
  created_at: string;
  tenants?: TenantRecord | null;
};

export type MarketingAssetRecord = {
  id: string;
  tenant_id: string;
  attendance_id: string | null;
  media_id: string | null;
  kind: "post" | "story" | "promo";
  title: string | null;
  generated_text: string;
  cta: string | null;
  hashtags: string[];
  status: "draft" | "approved" | "discarded";
  prompt_snapshot: Record<string, unknown>;
  created_at: string;
  approved_at: string | null;
  attendance?: AttendanceRecord | null;
  media?: AttendanceMediaRecord | null;
};

export type SocialPublicationRecord = {
  id: string;
  tenant_id: string;
  marketing_asset_id: string;
  platform: "instagram";
  status: "pending" | "publishing" | "published" | "failed";
  instagram_media_id: string | null;
  instagram_publish_id: string | null;
  published_at: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformSettingsRecord = {
  key: string;
  platform_name: string;
  logo_url: string | null;
  primary_domain: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  smtp_from_email: string | null;
  resend_from_email: string | null;
  resend_reply_to_email: string | null;
  resend_webhook_id: string | null;
  resend_webhook_secret: string | null;
  whatsapp_provider: string | null;
  whatsapp_base_url: string | null;
  evolution_instance: string | null;
  evolution_api_key: string | null;
  evolution_enabled: boolean;
  default_return_reminder_enabled: boolean;
  default_return_reminder_days: number;
  default_return_reminder_time: string | null;
  default_queue_entry_message: string | null;
  default_wash_start_message: string | null;
  default_ready_message: string | null;
  default_return_reminder_message: string | null;
};

export type AuditLogRecord = {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: string;
  tenant_id: string | null;
  actor_customer_id?: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  message: string;
  created_at: string;
};

export type LeadCompanyRecord = {
  id: string;
  cnpj: string | null;
  business_name: string;
  business_type: string;
  email: string | null;
  cnae_principal: string | null;
  cnae_secundaria: string | null;
  abertura_date: string | null;
  contato_quality: string | null;
  contact_risk_level: string | null;
  contact_role_hint: string | null;
  contact_evidence: string | null;
  recommended_channel: string | null;
  import_batch_label: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  google_maps_url: string | null;
  rating: number | null;
  review_count: number;
  source: string;
  raw_data: Record<string, unknown>;
  opportunity_score: number;
  opportunity_level: "baixa" | "media" | "alta";
  status: "found" | "analyzed" | "message_generated" | "contacted" | "responded" | "demo_scheduled" | "closed_won" | "lost" | "kept" | "archived";
  created_at: string;
  updated_at: string;
};

export type LeadAnalysisRecord = {
  id: string;
  lead_company_id: string;
  has_website: boolean;
  has_phone: boolean;
  has_google_maps: boolean;
  has_instagram: boolean;
  instagram_url: string | null;
  has_low_reviews: boolean;
  has_poor_presence: boolean;
  problems_found: string[];
  opportunity_reason: string | null;
  ai_summary: string | null;
  created_at: string;
};

export type LeadMessageRecord = {
  id: string;
  lead_company_id: string;
  subject: string | null;
  message_text: string;
  message_type: string;
  created_at: string;
};

export type LeadCompanyActivityRecord = {
  id: string;
  lead_company_id: string;
  activity_type: string;
  channel: string | null;
  note: string | null;
  created_by_email: string | null;
  created_at: string;
};

export type LeadEmailDispatchRecord = {
  id: string;
  lead_company_id: string;
  lead_message_id: string | null;
  provider: string;
  provider_email_id: string;
  recipient_email: string;
  subject: string;
  status: "sent" | "delivered" | "delivery_delayed" | "bounced" | "complained" | "opened" | "clicked" | "failed" | "suppressed" | "received";
  last_event: string;
  last_error: string | null;
  raw_events: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
};

export type LeadEmailSequenceRecord = {
  id: string;
  sequence_key: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LeadEmailSequenceStepRecord = {
  id: string;
  sequence_id: string;
  step_number: number;
  subject: string | null;
  body_text: string | null;
  image_url: string | null;
  delay_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LeadEmailSequenceEnrollmentRecord = {
  id: string;
  lead_company_id: string;
  sequence_id: string;
  current_step: number;
  next_send_at: string | null;
  last_sent_at: string | null;
  status: "active" | "paused" | "completed" | "failed" | "unsubscribed";
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadHunterJobRecord = {
  id: string;
  niche: string;
  city: string;
  state: string;
  radius_km: number;
  max_results: number;
  total_found: number;
  total_saved: number;
  total_duplicates: number;
  status: "running" | "finished" | "failed";
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
};

export type TenantCompanyProfileRecord = {
  tenant_id: string;
  legal_name: string;
  trade_name: string;
  cnpj: string | null;
  state_registration: string | null;
  municipal_registration: string | null;
  email: string | null;
  phone: string | null;
  phone_secondary: string | null;
  website?: string | null;
  postal_code: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  representative_name: string;
  representative_role: string | null;
  representative_email: string;
  representative_phone: string | null;
  representative_phone_secondary: string | null;
};

export type TenantLandingPageRecord = {
  tenant_id: string;
  category: string | null;
  city_label: string | null;
  bio: string | null;
  background_style:
    | "dark"
    | "white"
    | "gray"
    | "black"
    | "lilac"
    | "theme"
    | "water"
    | "pet"
    | "bodyshop"
    | "mechanic"
    | "fashion"
    | "furniture";
  cover_image_url: string | null;
  profile_image_url: string | null;
  contact_email: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  website_url: string | null;
  address_label: string | null;
  map_embed_url: string | null;
  opening_hours: string | null;
  cta_whatsapp_message: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type TenantReviewRecord = {
  id: string;
  tenant_id: string;
  customer_name: string;
  rating: number;
  quote: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryShelfRecord = {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  note: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryItemRecord = {
  id: string;
  tenant_id: string;
  shelf_id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  sku: string | null;
  category: string | null;
  supplier: string | null;
  unit: string;
  quantity: number;
  min_quantity: number;
  cost_price: number;
  sale_price: number;
  package_size: string | null;
  location_label: string | null;
  batch_code: string | null;
  expiration_date: string | null;
  notes: string | null;
  last_entry_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryMovementRecord = {
  id: string;
  tenant_id: string;
  item_id: string;
  shelf_id: string;
  kind: InventoryMovementKind;
  quantity: number;
  unit_cost: number | null;
  note: string | null;
  source: string;
  created_by: string | null;
  created_at: string;
};

export type AccessContext =
  | {
      kind: "anonymous";
    }
  | {
      kind: "platform_admin";
      userId: string;
      email: string | null;
      role: PlatformRole;
      profile: ProfileRecord | null;
    }
  | {
      kind: "tenant_user";
      userId: string;
      email: string | null;
      role: TenantRole;
      tenantId: string;
      tenant: TenantRecord;
      profile: ProfileRecord | null;
    };

export type VehicleUsageType = "particular" | "app_driver" | "taxi" | "company" | "other_professional";
export type VehicleSizeTier = "passeio" | "medio" | "grande" | "bem_grande";
export type VehicleTierSource = "engine" | "lookup" | "manual";
export type VehicleSource = "operator" | "portal" | "lookup";
export type CustomerPaymentMode = "order_without_online_payment" | "online_required";
export type PaymentIntentStatus = "not_required" | "pending" | "succeeded" | "failed" | "refunded" | "canceled";

export type CustomerCredentialRecord = {
  customer_id: string;
  tenant_id: string;
  password_hash: string;
  failed_attempts: number;
  locked_until: string | null;
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerSessionRecord = {
  id: string;
  customer_id: string;
  tenant_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string;
  created_at: string;
  created_ip: string | null;
  user_agent: string | null;
};

export type RateLimitRecord = {
  key: string;
  count: number;
  reset_at: string;
};

export type LoyaltyProgramRecord = {
  id: string;
  tenant_id: string;
  name: string;
  washes_required: number;
  reward_type: string;
  eligibility_rule: "concluded" | "concluded_and_paid";
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LoyaltyEntryRecord = {
  id: string;
  tenant_id: string;
  customer_id: string;
  vehicle_id: string;
  attendance_id: string | null;
  kind: "wash" | "adjustment" | "reversal";
  wash_number: number;
  cycle_started_at: string;
  event_date: string;
  source: "attendance_delivered" | "portal" | "operator" | "system";
  actor_customer_id: string | null;
  actor_user_id: string | null;
  reversal_reason: string | null;
  idempotency_key: string;
  created_at: string;
};

export type LoyaltyRewardRecord = {
  id: string;
  tenant_id: string;
  customer_id: string;
  vehicle_id: string;
  entry_id: string;
  status: "generated" | "available" | "used" | "reverted" | "canceled";
  used_attendance_id: string | null;
  used_at: string | null;
  reverted_at: string | null;
  canceled_at: string | null;
  cancel_reason: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AppointmentItemRecord = {
  id: string;
  tenant_id: string;
  appointment_id: string;
  service_id: string | null;
  name: string;
  unit_price: number;
  estimated_minutes: number | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
};

export type PaymentIntentRecord = {
  id: string;
  tenant_id: string;
  customer_id: string;
  attendance_id: string | null;
  amount: number;
  status: PaymentIntentStatus;
  payment_method: "pix" | "card" | "cash" | "other" | null;
  provider: string | null;
  provider_reference: string | null;
  idempotency_key: string;
  succeeded_at: string | null;
  failed_at: string | null;
  refunded_at: string | null;
  canceled_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_ip: string | null;
};

export type EntryTokenRecord = {
  id: string;
  tenant_id: string;
  phone_normalized: string;
  plate_normalized: string;
  purpose: "entry";
  token_hash: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderDraftRecord = {
  id: string;
  tenant_id: string;
  customer_id: string;
  vehicle_id: string;
  kind: "order" | "appointment";
  service_ids: string[];
  reward_id: string | null;
  idempotency_key: string;
  session_token_hash: string;
  status: "open" | "used" | "expired";
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type CustomerOrderSummary = {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  status: string;
  public_code: string;
  estimated_minutes: number | null;
  created_at: string;
  service_summary: string;
};

export type CustomerRegisterResult = {
  id: string;
  tenant_id: string;
  name: string;
  phone_normalized: string;
};

export type CustomerCatalogService = {
  id: string;
  name: string;
  short_description: string | null;
  kind: "main" | "extra";
  base_service_id: string | null;
  sort_order: number;
  price: number;
  price_passeio: number;
  price_medio: number;
  price_grande: number;
  price_bem_grande: number;
  price_app_passeio: number;
  price_app_medio: number;
  price_app_grande: number;
  price_app_bem_grande: number;
  addon_price_passeio: number;
  addon_price_medio: number;
  addon_price_grande: number;
  addon_price_bem_grande: number;
  addon_price_app_passeio: number;
  addon_price_app_medio: number;
  addon_price_app_grande: number;
  addon_price_app_bem_grande: number;
  minutes_passeio: number | null;
  minutes_medio: number | null;
  minutes_grande: number | null;
  minutes_bem_grande: number | null;
  addon_minutes: number;
  addon_minutes_passeio: number | null;
  addon_minutes_medio: number | null;
  addon_minutes_grande: number | null;
  addon_minutes_bem_grande: number | null;
  average_minutes: number;
};

export type CustomerLoyaltySummary = {
  program_id: string;
  washes_required: number;
  washes_completed: number;
  reward_id: string | null;
  reward_status: string | null;
  reward_used_at: string | null;
  cycle_started_at: string | null;
};

/**
 * P2d QA fix: translation-key maps for the DB enums that were being
 * rendered raw to users (founder QA: "protect_ride/formal/
 * protego_vehicle on agent offer; PROTECT_RIDE/ESCORT/HOURLY in client
 * wizard header" — the latter was the raw serviceKey string plus
 * s.stepLabel's textTransform: "uppercase"). Centralized here since both
 * the client booking wizard and the agent offer screen need the same
 * service/dress-code/mobility labels.
 */
export const SERVICE_TITLE_KEY: Record<string, string> = {
  protect_ride: "home.rideTitle",
  escort: "home.escortTitle",
  hourly: "home.hourlyTitle",
};

export const DRESS_CODE_KEY: Record<string, string> = {
  formal: "booking.dressFormal",
  casual: "booking.dressCasual",
  discreet: "booking.dressCivil",
};

export const MOBILITY_KEY: Record<string, string> = {
  protego_vehicle: "booking.vehProtego",
  client_vehicle: "booking.vehClient",
  on_foot: "booking.onFoot",
};

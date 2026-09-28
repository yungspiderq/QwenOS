/* ============ QwenOS core — единственный реестр приложений ============ */
/* Загружается ПЕРВЫМ: до games/shop/doom/apps2/apps/os. */
window.Apps = {};
window.registerApp = function(id, def) { window.Apps[id] = def; };

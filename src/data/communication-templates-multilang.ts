/**
 * Template messaggi multilingua per Accoglienza > Comunicazione
 * Lingue: Italiano, English, Français, Deutsch
 * Tono: Amichevole e caloroso
 */

export interface MultilingualTemplate {
  key: string;
  label: string;
  category: 'check-in' | 'check-out' | 'benvenuto' | 'regole' | 'wifi' | 'emergenza' | 'feedback';
  channel: 'whatsapp' | 'email' | 'internal';
  languages: {
    it: string;
    en: string;
    fr: string;
    de: string;
  };
  properties?: string[]; // Se vuoto, disponibile per tutte
}

// Configurazione proprietà
const PROPERTIES = {
  villa_sardegna: {
    name: 'Villa Sardegna',
    address: 'Via Lisambuli 33h',
    id: '472bb155-27b1-4edd-8fd9-146ea0d24885',
  },
  vertova_trilocale: {
    name: 'Vertova Trilocale con Giardino',
    address: 'Via Cadelora 6, Vertova',
    id: 'b0b7311a-31cc-4230-a8c4-02a14ee4932a',
  },
  passo_mendola: {
    name: 'Villa Imperiale Passo Mendola',
    address: 'Passo Mendola, Ruffrè',
    id: 'ddb3c520-f064-4cc7-8e42-9e000efd61b4',
  },
};

export const multilingualTemplates: MultilingualTemplate[] = [
  // =====================================================
  // BENVENUTO OSPITE
  // =====================================================
  {
    key: 'welcome-guest',
    label: 'Benvenuto ospite',
    category: 'benvenuto',
    channel: 'email',
    languages: {
      it: `Ciao! 👋

Benvenuto nella nostra meravigliosa proprietà! Siamo felicissimi di averti come ospite.

Abbiamo preparato tutto al meglio per rendere il tuo soggiorno indimenticabile. Se hai bisogno di aiuto con qualsiasi cosa, sono qui per te!

📱 Nel tuo portale ospite troverai:
• Istruzioni dettagliate per check-in e check-out
• Codici WiFi e accessi
• Numeri di emergenza
• Guida completa della proprietà
• Gestione dei pagamenti

Se hai domande prima dell'arrivo, non esitare a contattarmi:
📞 ${process.env.GUEST_PHONE || '3917924372'}
📧 ${process.env.GUEST_EMAIL || 'info@edvcostruzioni.com'}

A presto,
Kristian Rinaldi`,
      en: `Hi there! 👋

Welcome to our wonderful property! We're absolutely delighted to have you as our guest.

We've prepared everything to make your stay unforgettable. If you need help with anything, I'm here for you!

📱 In your guest portal you'll find:
• Detailed check-in and check-out instructions
• WiFi and access codes
• Emergency numbers
• Complete property guide
• Payment management

If you have any questions before arrival, don't hesitate to contact me:
📞 ${process.env.GUEST_PHONE || '3917924372'}
📧 ${process.env.GUEST_EMAIL || 'info@edvcostruzioni.com'}

See you soon,
Kristian Rinaldi`,
      fr: `Bonjour! 👋

Bienvenue dans notre magnifique propriété! Nous sommes ravis de vous accueillir comme invité.

Nous avons préparé tout le nécessaire pour rendre votre séjour inoubliable. Si vous avez besoin d'aide avec quoi que ce soit, je suis là pour vous!

📱 Dans votre portail invité, vous trouverez:
• Instructions détaillées pour l'arrivée et le départ
• Codes WiFi et d'accès
• Numéros d'urgence
• Guide complet de la propriété
• Gestion des paiements

Si vous avez des questions avant votre arrivée, n'hésitez pas à me contacter:
📞 ${process.env.GUEST_PHONE || '3917924372'}
📧 ${process.env.GUEST_EMAIL || 'info@edvcostruzioni.com'}

À bientôt,
Kristian Rinaldi`,
      de: `Hallo! 👋

Willkommen in unserem wunderschönen Anwesen! Wir freuen uns sehr, Sie als Gast begrüßen zu dürfen.

Wir haben alles vorbereitet, um Ihren Aufenthalt unvergesslich zu machen. Wenn Sie bei irgendetwas Hilfe benötigen, bin ich für Sie da!

📱 In Ihrem Gästebrowser finden Sie:
• Detaillierte Check-in- und Check-out-Anweisungen
• WiFi- und Zugriffscodes
• Notfallnummern
• Vollständiger Eigenschaftsführer
• Zahlungsverwaltung

Wenn Sie vor Ihrer Ankunft Fragen haben, zögern Sie nicht, mich zu kontaktieren:
📞 ${process.env.GUEST_PHONE || '3917924372'}
📧 ${process.env.GUEST_EMAIL || 'info@edvcostruzioni.com'}

Bis bald,
Kristian Rinaldi`,
    },
  },

  // =====================================================
  // CHECK-IN ISTRUZIONI
  // =====================================================
  {
    key: 'checkin-instructions',
    label: 'Check-in - Istruzioni',
    category: 'check-in',
    channel: 'email',
    languages: {
      it: `Ciao! 🔑

Ecco tutto quello che devi sapere per il tuo check-in:

📍 DOVE: La proprietà si trova a {{PROPERTY_ADDRESS}}

🕐 ORARIO: Check-in dalle 15:00 in poi
Se hai bisogno di un orario diverso, contattami con anticipo!

👤 COSA PORTARE:
✓ Documento d'identità (obbligatorio)
✓ Tessera sanitaria/assicurazione viaggio
✓ Chiavi di casa (se hai una copia precedente)

🔓 ACCESSO:
Troverai le chiavi {{ACCESS_METHOD}} - guarda il portale ospite per i codici specifici.

💡 ALL'ARRIVO:
1. Accedi alla proprietà
2. Controlla che tutto sia in ordine
3. Familiarizzati con gli spazi
4. Segnalami eventuali problemi tramite il portale

📱 CONTATTI EMERGENZA:
📞 {{EMERGENCY_PHONE}}
📧 {{EMERGENCY_EMAIL}}

Buon soggiorno! 🏡
Kristian`,
      en: `Hi! 🔑

Here's everything you need to know for your check-in:

📍 WHERE: The property is located at {{PROPERTY_ADDRESS}}

🕐 TIME: Check-in from 3:00 PM onwards
If you need a different time, contact me in advance!

👤 WHAT TO BRING:
✓ Valid ID (required)
✓ Health insurance card/travel insurance
✓ House keys (if you have a spare)

🔓 ACCESS:
You'll find the keys {{ACCESS_METHOD}} - check your guest portal for specific codes.

💡 UPON ARRIVAL:
1. Access the property
2. Check that everything is in order
3. Familiarize yourself with the spaces
4. Report any issues to me via the portal

📱 EMERGENCY CONTACTS:
📞 {{EMERGENCY_PHONE}}
📧 {{EMERGENCY_EMAIL}}

Enjoy your stay! 🏡
Kristian`,
      fr: `Salut! 🔑

Voici tout ce que vous devez savoir pour votre arrivée:

📍 OÙ: La propriété est situé à {{PROPERTY_ADDRESS}}

🕐 HEURE: Arrivée à partir de 15h00
Si vous avez besoin d'une autre heure, contactez-moi à l'avance!

👤 QUE APPORTER:
✓ Pièce d'identité valide (obligatoire)
✓ Carte d'assurance maladie/assurance voyage
✓ Clés de maison (si vous en avez un double)

🔓 ACCÈS:
Vous trouverez les clés {{ACCESS_METHOD}} - consultez votre portail invité pour les codes spécifiques.

💡 À L'ARRIVÉE:
1. Accédez à la propriété
2. Vérifiez que tout est en ordre
3. Familiarisez-vous avec les espaces
4. Signalez-moi tout problème via le portail

📱 CONTACTS D'URGENCE:
📞 {{EMERGENCY_PHONE}}
📧 {{EMERGENCY_EMAIL}}

Bon séjour! 🏡
Kristian`,
      de: `Hallo! 🔑

Hier ist alles, was Sie über Ihre Ankunft wissen müssen:

📍 WO: Das Anwesen befindet sich unter {{PROPERTY_ADDRESS}}

🕐 ZEIT: Check-in ab 15:00 Uhr
Wenn Sie eine andere Zeit benötigen, kontaktieren Sie mich im Voraus!

👤 WAS MITBRINGEN:
✓ Gültiger Ausweis (erforderlich)
✓ Krankenversicherungskarte/Reiseversicherung
✓ Haustür (falls Sie einen Schlüssel haben)

🔓 ZUGANG:
Sie finden die Schlüssel {{ACCESS_METHOD}} - prüfen Sie Ihr Gästebrowser auf spezifische Codes.

💡 BEI ANKUNFT:
1. Betreten Sie das Anwesen
2. Überprüfen Sie, dass alles in Ordnung ist
3. Machen Sie sich mit den Räumen vertraut
4. Melden Sie mir etwaige Probleme über das Portal

📱 NOTFALLKONTAKTE:
📞 {{EMERGENCY_PHONE}}
📧 {{EMERGENCY_EMAIL}}

Schönen Aufenthalt! 🏡
Kristian`,
    },
  },

  // =====================================================
  // CHECK-OUT ISTRUZIONI
  // =====================================================
  {
    key: 'checkout-instructions',
    label: 'Check-out - Istruzioni',
    category: 'check-out',
    channel: 'email',
    languages: {
      it: `Ciao! 👋

È stato un piacere averti con noi! Prima di partire, ecco come procedere:

🕐 ORARIO: Check-out entro le 11:00
Se hai bisogno di più tempo, contattami!

🧹 PRIMA DI ANDARE:
✓ Spegni tutte le luci
✓ Chiudi finestre e porte
✓ Riponi i vestiti negli armadi
✓ Lascia la cucina pulita
✓ Controlla che nulla sia rimasto indietro

🔑 RESTITUZIONE CHIAVI:
Lascia le chiavi {{KEY_RETURN_METHOD}} come specificato nel portale.

💰 CAUZIONE:
Se tutto è in ordine, riceverai il rimborso della cauzione entro 5 giorni lavorativi.
Se ci sono danni, ti contatterò per discutere.

📝 FEEDBACK:
Ci piacerebbe sapere come è stato il tuo soggiorno! Lascia una valutazione nel portale - è importante per noi!

🙏 Grazie mille e speriamo di rivederti presto!

Kristian`,
      en: `Hi! 👋

It's been a pleasure having you with us! Before you leave, here's how to proceed:

🕐 TIME: Check-out by 11:00 AM
If you need more time, contact me!

🧹 BEFORE YOU GO:
✓ Turn off all lights
✓ Close windows and doors
✓ Put away clothes in wardrobes
✓ Leave the kitchen clean
✓ Check nothing is left behind

🔑 KEY RETURN:
Leave the keys {{KEY_RETURN_METHOD}} as specified in the portal.

💰 DEPOSIT:
If everything is in order, you'll receive your deposit refund within 5 business days.
If there's any damage, I'll contact you to discuss.

📝 FEEDBACK:
We'd love to know how your stay was! Leave a review in the portal - it's important to us!

🙏 Thank you so much and we hope to see you again soon!

Kristian`,
      fr: `Salut! 👋

Ça a été un plaisir de vous accueillir! Avant de partir, voici comment procéder:

🕐 HEURE: Départ avant 11h00
Si vous avez besoin de plus de temps, contactez-moi!

🧹 AVANT DE PARTIR:
✓ Éteignez toutes les lumières
✓ Fermez fenêtres et portes
✓ Rangez les vêtements dans les armoires
✓ Laissez la cuisine propre
✓ Vérifiez que rien n'est oublié

🔑 RESTITUTION DES CLÉS:
Laissez les clés {{KEY_RETURN_METHOD}} comme indiqué dans le portail.

💰 DÉPÔT DE GARANTIE:
Si tout est en ordre, vous recevrez un remboursement de dépôt dans 5 jours ouvrables.
S'il y a des dégâts, je vous contacterai pour en discuter.

📝 AVIS:
Nous aimerions savoir comment s'est passé votre séjour! Laissez un avis dans le portail - c'est important pour nous!

🙏 Merci beaucoup et nous espérons vous revoir bientôt!

Kristian`,
      de: `Hallo! 👋

Es war eine Freude, Sie bei uns zu haben! Bevor Sie gehen, so funktioniert das Auschecken:

🕐 ZEIT: Abreise bis 11:00 Uhr
Wenn Sie mehr Zeit benötigen, kontaktieren Sie mich!

🧹 VOR IHRER ABREISE:
✓ Schalten Sie alle Lichter aus
✓ Schließen Sie Fenster und Türen
✓ Räumen Sie die Kleidung in Schränke
✓ Hinterlassen Sie die Küche sauber
✓ Überprüfen Sie, dass nichts vergessen ist

🔑 SCHLÜSSELRÜCKGABE:
Hinterlassen Sie die Schlüssel {{KEY_RETURN_METHOD}} wie im Portal angegeben.

💰 KAUTION:
Wenn alles in Ordnung ist, erhalten Sie Ihre Kaution innerhalb von 5 Werktagen zurück.
Bei Schäden kontaktiere ich Sie gerne, um zu besprechen.

📝 BEWERTUNG:
Wir würden gerne wissen, wie Ihr Aufenthalt war! Hinterlassen Sie eine Bewertung im Portal - das ist uns wichtig!

🙏 Vielen Dank und wir hoffen, Sie bald wiederzusehen!

Kristian`,
    },
  },

  // =====================================================
  // REGOLE CASA
  // =====================================================
  {
    key: 'house-rules',
    label: 'Regole della casa',
    category: 'regole',
    channel: 'email',
    languages: {
      it: `Ciao! 📋

Ecco le regole della casa per rendere il soggiorno piacevole per tutti:

🚭 SMOKING & VAPING:
Fumare e usare sigarette elettroniche è vietato all'interno. Puoi fumare solo all'esterno.

🎵 RUMORE:
Per cortesia, mantieni il volume della musica e della TV a livelli ragionevoli.
Dopo le 22:00, cerca di ridurre al minimo il rumore.

👥 OSPITI:
Se hai intenzione di invitare ospiti, comunicamelo in anticipo.

🚗 PARCHEGGIO:
Parcheggia solo nei posti designati. Non intralciare l'accesso di altri.

🏊 PISCINA/GIARDINO (se applicabile):
Usa la piscina e il giardino solo durante le ore diurne.
Mantieni gli spazi puliti.

🧊 CUCINA:
Dopo aver cucinato, pulisci gli utensili e il piano di lavoro.
Non è possibile fumare in cucina.

🚫 VIETATO:
✗ Animali domestici (a meno che non autorizzato)
✗ Feste/eventi senza autorizzazione
✗ Modifiche alla proprietà
✗ Subaffitto o airbnb

💡 REGOLE GENERALI:
✓ Tratta la proprietà come fosse la tua casa
✓ Segnala subito qualsiasi danno
✓ Mantieni gli spazi comuni puliti
✓ Rispetta gli orari di check-in e check-out

Se hai domande, contattami!
Kristian
📞 {{EMERGENCY_PHONE}}`,
      en: `Hi! 📋

Here are the house rules to make everyone's stay pleasant:

🚭 SMOKING & VAPING:
Smoking and vaping are prohibited indoors. You can smoke only outside.

🎵 NOISE:
Please keep music and TV volume at reasonable levels.
After 10:00 PM, try to minimize noise.

👥 GUESTS:
If you plan to invite guests, let me know in advance.

🚗 PARKING:
Park only in designated spots. Don't block access for others.

🏊 POOL/GARDEN (if applicable):
Use the pool and garden only during daylight hours.
Keep the spaces clean.

🧊 KITCHEN:
After cooking, clean utensils and the work surface.
No smoking in the kitchen.

🚫 PROHIBITED:
✗ Pets (unless authorized)
✗ Parties/events without permission
✗ Property modifications
✗ Subletting or airbnb

💡 GENERAL RULES:
✓ Treat the property as if it were your own home
✓ Report any damage immediately
✓ Keep common areas clean
✓ Respect check-in and check-out times

If you have questions, contact me!
Kristian
📞 {{EMERGENCY_PHONE}}`,
      fr: `Salut! 📋

Voici les règles de la maison pour rendre le séjour agréable pour tous:

🚭 TABAGISME & VAPOTAGE:
Le tabagisme et le vapotage sont interdits à l'intérieur. Vous pouvez fumer uniquement à l'extérieur.

🎵 BRUIT:
Veuillez maintenir le volume de la musique et de la télévision à des niveaux raisonnables.
Après 22h00, essayez de minimiser le bruit.

👥 INVITÉS:
Si vous prévoyez d'inviter des amis, avertissez-moi à l'avance.

🚗 PARKING:
Stationnez uniquement dans les emplacements désignés. N'obstruez pas l'accès d'autres.

🏊 PISCINE/JARDIN (le cas échéant):
Utilisez la piscine et le jardin uniquement pendant les heures diurnes.
Gardez les espaces propres.

🧊 CUISINE:
Après la cuisson, nettoyez les ustensiles et la surface de travail.
Pas de tabagisme dans la cuisine.

🚫 INTERDIT:
✗ Animaux de compagnie (sauf autorisation)
✗ Fêtes/événements sans permission
✗ Modifications de la propriété
✗ Sous-location ou airbnb

💡 RÈGLES GÉNÉRALES:
✓ Traitez la propriété comme si elle était votre propre maison
✓ Signalez immédiatement tout dommage
✓ Gardez les zones communes propres
✓ Respectez les horaires d'arrivée et de départ

Si vous avez des questions, contactez-moi!
Kristian
📞 {{EMERGENCY_PHONE}}`,
      de: `Hallo! 📋

Hier sind die Hausregeln, um den Aufenthalt angenehm für alle zu gestalten:

🚭 RAUCHEN & DAMPFEN:
Rauchen und Dampfen sind drinnen verboten. Sie dürfen nur draußen rauchen.

🎵 LÄRM:
Bitte halten Sie die Musik- und Fernsehlautstärke auf angemessenem Niveau.
Nach 22:00 Uhr versuchen Sie bitte, Lärm zu minimieren.

👥 GÄSTE:
Wenn Sie Gäste einladen möchten, benachrichtigen Sie mich im Voraus.

🚗 PARKEN:
Parken Sie nur an den vorgesehenen Stellen. Blockieren Sie keinen Zugang für andere.

🏊 POOL/GARTEN (falls vorhanden):
Nutzen Sie Pool und Garten nur tagsüber.
Halten Sie die Bereiche sauber.

🧊 KÜCHE:
Nach dem Kochen reinigen Sie Utensilien und die Arbeitsfläche.
Rauchen in der Küche ist nicht gestattet.

🚫 VERBOTEN:
✗ Haustiere (sofern nicht genehmigt)
✗ Partys/Veranstaltungen ohne Genehmigung
✗ Änderungen am Anwesen
✗ Weitervermietung oder airbnb

💡 ALLGEMEINE REGELN:
✓ Behandeln Sie das Anwesen wie Ihr eigenes Zuhause
✓ Melden Sie Schäden sofort
✓ Halten Sie Gemeinschaftsbereiche sauber
✓ Beachten Sie Check-in und Check-out-Zeiten

Bei Fragen kontaktieren Sie mich!
Kristian
📞 {{EMERGENCY_PHONE}}`,
    },
  },

  // =====================================================
  // WiFi & ACCESSI
  // =====================================================
  {
    key: 'wifi-access',
    label: 'WiFi & Codici Accesso',
    category: 'wifi',
    channel: 'email',
    languages: {
      it: `Ciao! 📶

Ecco tutti i codici di accesso e le informazioni WiFi:

🔐 CODICI ACCESSO PRINCIPALE:
Porta principale: {{DOOR_CODE}}
(Se applicabile: citofono, cassetta di sicurezza, etc.)

📶 WIFI:
Nome rete: {{WIFI_SSID}}
Password: {{WIFI_PASSWORD}}

🔌 UTILITÀ:
💡 Corrente: Interruttore generale in {{POWER_LOCATION}}
🚰 Acqua: Rubinetto principale in {{WATER_LOCATION}}
🌡️ Riscaldamento: Termostato in {{HEATING_LOCATION}}

📺 ENTERTAINMENT:
TV: {{TV_INFO}}
Musica: {{MUSIC_INFO}}
(Se disponibile)

🗝️ CHIAVI:
✓ Porta principale
✓ Giardino (se applicabile)
✓ Garage (se applicabile)

⚠️ IMPORTANTE:
- Non condividere i codici con non autorizzati
- Tratta i codici come informazioni private
- Se perdi la chiave, contattami immediatamente
- Se i codici non funzionano, riprova o contattami

📞 Se hai problemi di accesso:
{{EMERGENCY_PHONE}}
{{EMERGENCY_EMAIL}}

Buon collegamento! 📡
Kristian`,
      en: `Hi! 📶

Here are all access codes and WiFi information:

🔐 MAIN ACCESS CODES:
Main door: {{DOOR_CODE}}
(If applicable: intercom, safe, etc.)

📶 WiFi:
Network name: {{WIFI_SSID}}
Password: {{WIFI_PASSWORD}}

🔌 UTILITIES:
💡 Electricity: Main switch at {{POWER_LOCATION}}
🚰 Water: Main faucet at {{WATER_LOCATION}}
🌡️ Heating: Thermostat at {{HEATING_LOCATION}}

📺 ENTERTAINMENT:
TV: {{TV_INFO}}
Music: {{MUSIC_INFO}}
(If available)

🗝️ KEYS:
✓ Main door
✓ Garden (if applicable)
✓ Garage (if applicable)

⚠️ IMPORTANT:
- Don't share codes with unauthorized people
- Treat codes as private information
- If you lose a key, contact me immediately
- If codes don't work, retry or contact me

📞 If you have access problems:
{{EMERGENCY_PHONE}}
{{EMERGENCY_EMAIL}}

Happy connecting! 📡
Kristian`,
      fr: `Salut! 📶

Voici tous les codes d'accès et informations WiFi:

🔐 CODES D'ACCÈS PRINCIPAL:
Porte principale: {{DOOR_CODE}}
(Le cas échéant: interphone, coffre-fort, etc.)

📶 WiFi:
Nom du réseau: {{WIFI_SSID}}
Mot de passe: {{WIFI_PASSWORD}}

🔌 SERVICES:
💡 Électricité: Interrupteur principal à {{POWER_LOCATION}}
🚰 Eau: Robinet principal à {{WATER_LOCATION}}
🌡️ Chauffage: Thermostat à {{HEATING_LOCATION}}

📺 DIVERTISSEMENT:
TV: {{TV_INFO}}
Musique: {{MUSIC_INFO}}
(Le cas échéant)

🗝️ CLÉS:
✓ Porte principale
✓ Jardin (le cas échéant)
✓ Garage (le cas échéant)

⚠️ IMPORTANT:
- Ne partagez pas les codes avec les non-autorisés
- Traitez les codes comme des informations privées
- Si vous perdez une clé, contactez-moi immédiatement
- Si les codes ne fonctionnent pas, réessayez ou contactez-moi

📞 Si vous avez des problèmes d'accès:
{{EMERGENCY_PHONE}}
{{EMERGENCY_EMAIL}}

Bonne connexion! 📡
Kristian`,
      de: `Hallo! 📶

Hier sind alle Zugriffscodes und WiFi-Informationen:

🔐 HAUPTZUGRIFFSCODES:
Haupttür: {{DOOR_CODE}}
(Falls zutreffend: Gegensprechanlage, Safe, etc.)

📶 WiFi:
Netzwerkname: {{WIFI_SSID}}
Passwort: {{WIFI_PASSWORD}}

🔌 VERSORGUNGSLEITUNGEN:
💡 Strom: Hauptschalter bei {{POWER_LOCATION}}
🚰 Wasser: Haupthahn bei {{WATER_LOCATION}}
🌡️ Heizung: Thermostat bei {{HEATING_LOCATION}}

📺 UNTERHALTUNG:
TV: {{TV_INFO}}
Musik: {{MUSIC_INFO}}
(Falls vorhanden)

🗝️ SCHLÜSSEL:
✓ Haupttür
✓ Garten (falls vorhanden)
✓ Garage (falls vorhanden)

⚠️ WICHTIG:
- Teilen Sie Codes nicht mit Unbefugten
- Behandeln Sie Codes als private Informationen
- Wenn Sie einen Schlüssel verlieren, kontaktieren Sie mich sofort
- Wenn Codes nicht funktionieren, versuchen Sie es erneut oder kontaktieren Sie mich

📞 Bei Zugriffsproblemen:
{{EMERGENCY_PHONE}}
{{EMERGENCY_EMAIL}}

Viel Spaß beim Verbinden! 📡
Kristian`,
    },
  },

  // =====================================================
  // EMERGENZE & CONTATTI
  // =====================================================
  {
    key: 'emergency-contacts',
    label: 'Emergenze & Contatti',
    category: 'emergenza',
    channel: 'email',
    languages: {
      it: `Ciao! 🆘

Per la tua sicurezza e tranquillità, ecco i contatti di emergenza:

🆘 IN CASO DI EMERGENZA REALE:
📞 112 - Polizia, Vigili del Fuoco, Ambulanza
(VALIDO PER TUTTE LE EMERGENZE MEDICHE E DI SICUREZZA)

📞 MY CONTACTS:
Kristian Rinaldi: {{EMERGENCY_PHONE}}
Email: {{EMERGENCY_EMAIL}}

🏥 OSPEDALI PIÙ VICINI:
(Informazioni specifiche per la proprietà - da aggiornare in base alla posizione)

🔧 EMERGENZE TECNICA:
• Acqua/Tubature: Contattami subito {{EMERGENCY_PHONE}}
• Elettricità: Contattami subito {{EMERGENCY_PHONE}}
• Riscaldamento: Contattami subito {{EMERGENCY_PHONE}}
• Serrature: Contattami subito {{EMERGENCY_PHONE}}

⚠️ COSA FARE IN CASO DI EMERGENZA:
1. Rimani calmo
2. Valuta il pericolo
3. Se pericolo di vita → chiama 112
4. Per problemi tecnici non urgenti → contattami
5. Documenta il problema (foto/video)
6. Apri un ticket nel portale ospite

🔒 SICUREZZA:
- Chiudi sempre porte e finestre prima di dormire
- Non condividere i codici con sconosciuti
- Se noti qualcosa di strano, contattami

Spero che non avrai bisogno di queste informazioni, ma è bene saperle!

Kristian 🙏`,
      en: `Hi! 🆘

For your safety and peace of mind, here are the emergency contacts:

🆘 IN CASE OF REAL EMERGENCY:
📞 112 - Police, Fire Department, Ambulance
(VALID FOR ALL MEDICAL AND SAFETY EMERGENCIES)

📞 MY CONTACTS:
Kristian Rinaldi: {{EMERGENCY_PHONE}}
Email: {{EMERGENCY_EMAIL}}

🏥 NEAREST HOSPITALS:
(Property-specific information - to be updated based on location)

🔧 TECHNICAL EMERGENCIES:
• Water/Plumbing: Contact me immediately {{EMERGENCY_PHONE}}
• Electricity: Contact me immediately {{EMERGENCY_PHONE}}
• Heating: Contact me immediately {{EMERGENCY_PHONE}}
• Locks: Contact me immediately {{EMERGENCY_PHONE}}

⚠️ WHAT TO DO IN CASE OF EMERGENCY:
1. Stay calm
2. Assess the danger
3. If life-threatening → call 112
4. For non-urgent technical issues → contact me
5. Document the problem (photos/videos)
6. Open a ticket in the guest portal

🔒 SAFETY:
- Always lock doors and windows before sleeping
- Don't share codes with strangers
- If you notice anything strange, contact me

I hope you won't need this information, but it's good to know!

Kristian 🙏`,
      fr: `Salut! 🆘

Pour votre sécurité et votre tranquillité d'esprit, voici les contacts d'urgence:

🆘 EN CAS D'URGENCE RÉELLE:
📞 112 - Police, Pompiers, Ambulance
(VALIDE POUR TOUTES LES URGENCES MÉDICALES ET DE SÉCURITÉ)

📞 MES CONTACTS:
Kristian Rinaldi: {{EMERGENCY_PHONE}}
Email: {{EMERGENCY_EMAIL}}

🏥 HÔPITAUX LES PLUS PROCHES:
(Informations spécifiques à la propriété - à mettre à jour selon l'emplacement)

🔧 URGENCES TECHNIQUES:
• Eau/Plomberie: Contactez-moi immédiatement {{EMERGENCY_PHONE}}
• Électricité: Contactez-moi immédiatement {{EMERGENCY_PHONE}}
• Chauffage: Contactez-moi immédiatement {{EMERGENCY_PHONE}}
• Serrures: Contactez-moi immédiatement {{EMERGENCY_PHONE}}

⚠️ QUE FAIRE EN CAS D'URGENCE:
1. Restez calme
2. Évaluez le danger
3. Si danger de mort → appelez 112
4. Pour les problèmes techniques non urgents → me contacter
5. Documentez le problème (photos/vidéos)
6. Ouvrez un ticket sur le portail invité

🔒 SÉCURITÉ:
- Fermez toujours les portes et fenêtres avant de dormir
- Ne partagez pas les codes avec des étrangers
- Si vous remarquez quelque chose d'étrange, contactez-moi

J'espère que vous n'aurez pas besoin de ces informations, mais c'est bon de les connaître!

Kristian 🙏`,
      de: `Hallo! 🆘

Für Ihre Sicherheit und Ruhe finden Sie hier die Notfallkontakte:

🆘 IM NOTFALL:
📞 112 - Polizei, Feuerwehr, Krankenwagen
(GÜLTIG FÜR ALLE MEDIZINISCHEN UND SICHERHEITSNOTFÄLLE)

📞 MEINE KONTAKTE:
Kristian Rinaldi: {{EMERGENCY_PHONE}}
Email: {{EMERGENCY_EMAIL}}

🏥 NÄCHSTE KRANKENHÄUSER:
(Gebäudespezifische Informationen - je nach Standort zu aktualisieren)

🔧 TECHNISCHE NOTFÄLLE:
• Wasser/Rohre: Kontaktieren Sie mich sofort {{EMERGENCY_PHONE}}
• Elektrizität: Kontaktieren Sie mich sofort {{EMERGENCY_PHONE}}
• Heizung: Kontaktieren Sie mich sofort {{EMERGENCY_PHONE}}
• Schlösser: Kontaktieren Sie mich sofort {{EMERGENCY_PHONE}}

⚠️ WAS IM NOTFALL ZU TUN IST:
1. Bleiben Sie ruhig
2. Beurteilen Sie die Gefahr
3. Bei Lebensgefahr → 112 anrufen
4. Bei nicht dringenden technischen Problemen → kontaktieren Sie mich
5. Dokumentieren Sie das Problem (Fotos/Videos)
6. Öffnen Sie ein Ticket im Gästebrowser

🔒 SICHERHEIT:
- Schließen Sie vor dem Schlafengehen immer Türen und Fenster ab
- Teilen Sie Codes nicht mit Fremden
- Wenn Sie etwas Seltsames bemerken, kontaktieren Sie mich

Ich hoffe, Sie brauchen diese Informationen nicht, aber es ist gut zu wissen!

Kristian 🙏`,
    },
  },

  // =====================================================
  // FEEDBACK & VALUTAZIONE
  // =====================================================
  {
    key: 'feedback-survey',
    label: 'Feedback - Valutazione soggiorno',
    category: 'feedback',
    channel: 'email',
    languages: {
      it: `Ciao! ⭐

È stato un vero piacere averti da noi! Il tuo soggiorno è terminato, ma vogliamo assicurarci che sia stato perfetto.

💬 TI CHIEDIAMO UNO SFORZO MINIMO:
Dedica 2 minuti per lasciarci un feedback nel portale ospite. È importante per noi!

📝 COSA VALUTARE:
✓ Pulizia della proprietà
✓ Precisione dell'annuncio
✓ Comunicazione prima dell'arrivo
✓ Qualità degli arredi
✓ Servizi e comodità
✓ Accoglienza e supporto

⭐ LASCIA UNA RECENSIONE:
Le tue stelle aiutano altri ospiti a scegliere. Anche i feedback negativi sono preziosi per migliorare!

🎁 SORPRESA:
Se lasci una valutazione 5 stelle, ti contatterò con un'offerta speciale per la tua prossima prenotazione!

📞 PROBLEMI?
Se c'è stato qualcosa che non ha funzionato, raccontamelo prima di lasciare una valutazione negativa.
Voglio risolverlo per te!
{{EMERGENCY_PHONE}}

🙏 GRAZIE dalla parte di tutto il team!

Speriamo di rivederti presto,
Kristian ❤️`,
      en: `Hi! ⭐

It's been a real pleasure having you with us! Your stay has ended, but we want to make sure it was perfect.

💬 WE ASK FOR MINIMAL EFFORT:
Spend 2 minutes to leave us feedback in the guest portal. It's important to us!

📝 WHAT TO RATE:
✓ Property cleanliness
✓ Listing accuracy
✓ Communication before arrival
✓ Quality of furnishings
✓ Services and amenities
✓ Welcome and support

⭐ LEAVE A REVIEW:
Your stars help other guests choose. Even negative feedback is valuable for improvement!

🎁 SURPRISE:
If you leave a 5-star review, I'll contact you with a special offer for your next booking!

📞 PROBLEMS?
If something didn't work, tell me before leaving a negative review.
I want to fix it for you!
{{EMERGENCY_PHONE}}

🙏 THANK YOU from the whole team!

Hope to see you again soon,
Kristian ❤️`,
      fr: `Salut! ⭐

Ça a été un vrai plaisir de vous accueillir chez nous! Votre séjour est terminé, mais nous voulons nous assurer qu'il était parfait.

💬 NOUS VOUS DEMANDONS UN EFFORT MINIMAL:
Passez 2 minutes pour nous laisser un avis dans le portail invité. C'est important pour nous!

📝 QUOI ÉVALUER:
✓ Propreté de la propriété
✓ Exactitude de l'annonce
✓ Communication avant l'arrivée
✓ Qualité du mobilier
✓ Services et équipements
✓ Accueil et soutien

⭐ LAISSEZ UN AVIS:
Vos étoiles aident d'autres invités à choisir. Même les avis négatifs sont précieux pour l'amélioration!

🎁 SURPRISE:
Si vous laissez un avis 5 étoiles, je vous contacterai avec une offre spéciale pour votre prochain séjour!

📞 PROBLÈMES?
Si quelque chose n'a pas fonctionné, dites-le moi avant de laisser un avis négatif.
Je veux le régler pour vous!
{{EMERGENCY_PHONE}}

🙏 MERCI de la part de toute l'équipe!

Espérons vous revoir bientôt,
Kristian ❤️`,
      de: `Hallo! ⭐

Es war eine echte Freude, Sie bei uns zu haben! Ihr Aufenthalt ist beendet, aber wir möchten sicherstellen, dass er perfekt war.

💬 WIR BITTEN SIE UM MINIMALEN AUFWAND:
Verbringen Sie 2 Minuten, um uns ein Feedback im Gästebrowser zu geben. Es ist uns wichtig!

📝 WAS ZU BEWERTEN IST:
✓ Sauberkeit des Anwesens
✓ Genauigkeit der Anzeige
✓ Kommunikation vor der Ankunft
✓ Qualität der Einrichtung
✓ Services und Ausstattung
✓ Empfang und Support

⭐ HINTERLASSEN SIE EINE BEWERTUNG:
Ihre Sterne helfen anderen Gästen zu wählen. Auch negatives Feedback ist wertvoll zur Verbesserung!

🎁 ÜBERRASCHUNG:
Wenn Sie eine 5-Sterne-Bewertung hinterlassen, kontaktiere ich Sie mit einem Sonderangebot für Ihren nächsten Aufenthalt!

📞 PROBLEME?
Wenn etwas nicht funktioniert hat, sagen Sie mir, bevor Sie eine negative Bewertung hinterlassen.
Ich möchte es für Sie beheben!
{{EMERGENCY_PHONE}}

🙏 VIELEN DANK vom ganzen Team!

Hoffentlich sehen wir Sie bald wieder,
Kristian ❤️`,
    },
  },
];

export default multilingualTemplates;

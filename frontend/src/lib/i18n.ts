// Trilingual UI dictionary: English, Kiswahili, Af-Soomaali.
// Static labels switch instantly. Long page text can be translated on demand with Gemini (/api/translate).
// Kiswahili and Somali strings should be reviewed by county translators before official publication.
export type Lang = 'en' | 'sw' | 'so'

const D: Record<string, [string, string, string]> = {
  // navigation
  'nav.home': ['Risk map', 'Ramani ya hatari', 'Khariidadda khatarta'],
  'nav.about': ['About CSG', 'Kuhusu CSG', 'Ku saabsan CSG'],
  'nav.policy': ['Partnerships policy', 'Sera ya ushirikiano', 'Siyaasadda iskaashiga'],
  'nav.elnino': ['El Niño warning', 'Tahadhari ya El Niño', 'Digniinta El Niño'],
  'nav.tana': ['Tana & Seven Forks', 'Tana na Seven Forks', 'Tana iyo Seven Forks'],
  'nav.health': ['Health & WASH', 'Afya na WASH', 'Caafimaadka & WASH'],
  'nav.nbs': ['Nature-based solutions', 'Suluhisho za kimaumbile', 'Xalalka dabiiciga ah'],
  'nav.community': ['Community maps', 'Ramani za jamii', 'Khariidadaha bulshada'],
  'nav.gallery': ['Gallery', 'Picha', 'Sawirro'],
  'nav.report': ['Report emergency', 'Ripoti dharura', 'Soo sheeg xaalad degdeg'],

  'site.title': ['Garissa County Steering Group', 'Kamati ya Uongozi ya Kaunti ya Garissa', 'Guddiga Hagista Gobolka Garissa'],
  'site.subtitle': ['Smart early-warning & coordination portal', 'Lango la tahadhari ya mapema na uratibu', 'Bogga digniinta hore iyo isku-duwidda'],
  'site.partners': ['In partnership with', 'Kwa ushirikiano na', 'Iyadoo lala kaashanayo'],

  // home
  'home.mapTitle': ['Garissa County flood & El Niño risk map', 'Ramani ya hatari ya mafuriko na El Niño – Garissa', 'Khariidadda khatarta fatahaadda & El Niño – Garissa'],
  'home.layers': ['Map layers', 'Tabaka za ramani', 'Lakabyada khariidadda'],
  'home.basemap': ['Base map', 'Ramani ya msingi', 'Khariidadda saldhigga'],
  'home.legend': ['Legend', 'Ufafanuzi', 'Sharaxaad'],
  'home.reset': ['Fit to Garissa', 'Rudi Garissa', 'Ku celi Garissa'],
  'home.simulate': ['Flood simulator', 'Kiigaji cha mafuriko', 'Jilitaanka fatahaadda'],
  'home.stage': ['Tana gauge at Garissa', 'Kipimo cha Tana Garissa', 'Cabbiraadda Tana ee Garissa'],
  'home.wave': ['Flood wave from Seven Forks', 'Wimbi la mafuriko kutoka Seven Forks', 'Mowjadda fatahaadda ee Seven Forks'],
  'home.buffer': ['River Tana buffer', 'Ukanda wa Mto Tana', 'Xariijinta Webiga Tana'],
  'home.bufferTool': ['Buffer a point', 'Pima eneo kuzunguka', 'Cabbir hareeraha barta'],
  'home.clickMap': ['Click the map to place the buffer', 'Bofya ramani kuweka ukanda', 'Guji khariidadda si aad u dhigto'],
  'home.alertLevel': ['Current CSG alert level', 'Kiwango cha tahadhari sasa', 'Heerka digniinta hadda'],
  'home.forecastPeak': ['Forecast peak', 'Kilele kinachotarajiwa', 'Heerka ugu sarreeya ee la filayo'],

  // alert levels
  'lvl.normal': ['Normal', 'Kawaida', 'Caadi'],
  'lvl.watch': ['Watch', 'Angalia', 'Feejignaan'],
  'lvl.alert': ['Alert', 'Tahadhari', 'Digniin'],
  'lvl.alarm': ['Alarm', 'Hatari', 'Khatar'],
  'lvl.emergency': ['Emergency', 'Dharura', 'Xaalad degdeg'],

  // safety
  'safe.title': ['Stay safe this rainy season', 'Kaa salama msimu huu wa mvua', 'Ka badbaad xilligan roobka'],
  'safe.1': ['Move people, livestock and farm pumps to higher ground when the Tana passes 4 m.', 'Hamisha watu, mifugo na pampu mahali pa juu Tana ikizidi mita 4.', 'Dadka, xoolaha iyo matoorada u guuri meel sare marka Tana ay dhaafto 4 mitir.'],
  'safe.2': ['Never walk or drive through a flowing lagha – 30 cm of water can sweep a car away.', 'Usivuke lagha inayotiririka – maji ya sm 30 yanaweza kusomba gari.', 'Ha ka gudbin togga socda – 30 sm oo biyo ah waxay qaadi karaan gaari.'],
  'safe.3': ['Boil or treat drinking water and sleep under a mosquito net.', 'Chemsha au tibu maji ya kunywa na lala ndani ya chandarua.', 'Karkari ama nadiifi biyaha la cabbo, kuna seexo maro kaneeco.'],
  'safe.4': ['Call Kenya Red Cross 1199 or report to emergency@garissa.go.ke.', 'Piga Kenya Red Cross 1199 au ripoti kwa emergency@garissa.go.ke.', 'Wac Laanqeyrta Cas 1199 ama u soo sheeg emergency@garissa.go.ke.'],

  // common
  'btn.download': ['Download', 'Pakua', 'Soo deji'],
  'btn.send': ['Send report', 'Tuma ripoti', 'Dir warbixinta'],
  'btn.translate': ['Translate page with AI', 'Tafsiri ukurasa kwa AI', 'Ku tarjun bogga AI'],
  'btn.play': ['Play', 'Cheza', 'Daar'],
  'btn.pause': ['Pause', 'Simamisha', 'Jooji'],
  'btn.openMap': ['Open the risk map', 'Fungua ramani ya hatari', 'Fur khariidadda khatarta'],
  'chat.title': ['CSG GeoAI assistant', 'Msaidizi wa CSG GeoAI', 'Kaaliyaha CSG GeoAI'],
  'chat.placeholder': ['Ask, or tell the map what to show…', 'Uliza, au iambie ramani ionyeshe nini…', 'Weydii, ama u sheeg khariidadda waxa ay muujiso…'],
  'chat.hello': [
    'Hello! I am the CSG GeoAI assistant. I can show layers, find schools or boreholes near the Tana, simulate floods and explain the El Niño outlook. Try a suggestion below.',
    'Habari! Mimi ni msaidizi wa CSG GeoAI. Naweza kuonyesha tabaka, kupata shule au visima karibu na Tana, kuiga mafuriko na kueleza utabiri wa El Niño.',
    'Salaan! Waxaan ahay kaaliyaha CSG GeoAI. Waxaan muujin karaa lakabyada, helaa dugsiyada ama ceelasha u dhow Tana, jilaa fatahaadda, kuna sharxi karaa saadaasha El Niño.',
  ],
  'footer.powered': ['Web portal powered by the County Government of Garissa, Directorate of ICT & GIS', 'Lango hili linaendeshwa na Serikali ya Kaunti ya Garissa, Kurugenzi ya TEHAMA na GIS', 'Bogga waxaa maamula Dowladda Gobolka Garissa, Agaasinka ICT & GIS'],
  'footer.contact': ['Contact', 'Wasiliana', 'La xiriir'],
  'report.title': ['Report an emergency or send feedback', 'Ripoti dharura au tuma maoni', 'Soo sheeg xaalad degdeg ama dir ra’yi'],
  'report.lead': ['Your report goes to the CSG emergency desk at emergency@garissa.go.ke. For life-threatening situations call 1199 or 999 first.', 'Ripoti yako inaenda dawati la dharura la CSG kupitia emergency@garissa.go.ke. Kwa hatari ya maisha piga 1199 au 999 kwanza.', 'Warbixintaada waxay gaartaa miiska degdegga CSG ee emergency@garissa.go.ke. Haddii nolol khatar ku jirto marka hore wac 1199 ama 999.'],
}

export function t(key: string, lang: Lang): string {
  const e = D[key]
  if (!e) return key
  return e[lang === 'en' ? 0 : lang === 'sw' ? 1 : 2] || e[0]
}

export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'sw', label: 'Kiswahili', short: 'SW' },
  { id: 'so', label: 'Af-Soomaali', short: 'SO' },
]

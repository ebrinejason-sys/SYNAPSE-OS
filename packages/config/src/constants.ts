// packages/config/src/constants.ts

export const UGANDA_DISTRICTS = [
  'Abim','Adjumani','Agago','Alebtong','Amolatar','Amudat','Amuria',
  'Amuru','Apac','Arua','Budaka','Bududa','Bugiri','Bugweri','Buhweju',
  'Buikwe','Bukedea','Bukomansimbi','Bukwo','Bulambuli','Buliisa',
  'Bundibugyo','Bunyangabu','Bushenyi','Busia','Butaleja','Butebo',
  'Buvuma','Buyende','Dokolo','Gomba','Gulu','Hoima','Ibanda',
  'Iganga','Isingiro','Jinja','Kaabong','Kabale','Kabarole','Kaberamaido',
  'Kagadi','Kakumiro','Kalangala','Kaliro','Kalungu','Kampala','Kamuli',
  'Kamwenge','Kanungu','Kapchorwa','Kapelebyong','Karenga','Kasanda',
  'Kasese','Katakwi','Kayunga','Kazo','Kibale','Kiboga','Kibuku',
  'Kikuube','Kiruhura','Kiryandongo','Kisoro','Kitagwenda','Kitgum',
  'Koboko','Kole','Kotido','Kumi','Kwania','Kyankwanzi','Kyegegwa',
  'Kyenjojo','Kyotera','Lamwo','Lira','Luuka','Luwero','Lwengo',
  'Lyantonde','Madi-Okollo','Manafwa','Maracha','Masaka','Masindi',
  'Mayuge','Mbale','Mbarara','Mitooma','Mityana','Moroto','Moyo',
  'Mpigi','Mubende','Mukono','Nabilatuk','Nakapiripirit','Nakaseke',
  'Nakasongola','Namayingo','Namisindwa','Namutumba','Napak','Nebbi',
  'Ngora','Ntoroko','Ntungamo','Nwoya','Obongi','Omoro','Otuke',
  'Oyam','Pader','Pakwach','Pallisa','Rakai','Rubanda','Rubirizi',
  'Rukiga','Rukungiri','Rwampara','Sembabule','Serere','Sheema',
  'Sironko','Soroti','Tororo','Wakiso','Yumbe','Zombo',
] as const

export type UgandaDistrict = typeof UGANDA_DISTRICTS[number]

export const FACILITY_MODES = [
  'NATIVE','CONNECTED','HYBRID','SATELLITE','COMMUNITY_ACCESS',
] as const

export type FacilityMode = typeof FACILITY_MODES[number]

export const SITE_KINDS = [
  'main','satellite','warehouse','community_access','branch',
] as const

export type SiteKind = typeof SITE_KINDS[number]

export const FACILITY_TYPES = [
  'hospital','clinic','pharmacy','laboratory',
  'imaging_center','dental','mental_health','care_home',
] as const

export type FacilityType = typeof FACILITY_TYPES[number]

export const ALL_ROLES = [
  'platform_admin',
  'platform_observer',
  'hospital_admin','doctor','nurse','clinical_officer',
  'pharmacist','pharmacy_admin','pharmacy_cashier','pharmacy_store_manager',
  'lab_scientist','lab_admin',
  'radiologist','imaging_admin',
  'receptionist','billing_officer','insurance_officer',
  'patient',
] as const

export type SynapseRole = typeof ALL_ROLES[number]

export const PHARMACY_ROLES = [
  'pharmacy_admin','pharmacist','pharmacy_cashier','pharmacy_store_manager',
] satisfies SynapseRole[]

export const CLINICAL_ROLES = [
  'doctor','nurse','clinical_officer','radiologist',
] satisfies SynapseRole[]

export type AppSurface = 'web' | 'pharmacy' | 'mobile'

export const SESSION_COOKIE = 'synapse_session'
export const SESSION_DURATION_DAYS = 7

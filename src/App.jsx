import { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useAuthStore } from './store/authStore';
import { useVentrylStore } from './store/ventrylStore';
import { AuthScreens } from './screens/Auth';
import { useOrderRealtime, useDepotInboxRealtime, useProfileRealtime } from './lib/realtime';
import { kyc as kycApi, kyb as kybApi, notifications as notifApi, depots as depotsApi, profiles as profilesApi } from './lib/api';
import { supabase } from './lib/supabase';
import { printWaybill, printInvoice } from './lib/documents';
import { AdminPanel } from './screens/AdminPanel';
import { openPaystackPopup, verifyAndCreditWallet, FUND_PRESETS } from './lib/payment';

/* ════════════════════════════════════════════
   DESIGN TOKENS
════════════════════════════════════════════ */
const T = {
  black:"#000000",white:"#FFFFFF",green:"#06C167",greenLight:"#E6F9F1",greenDark:"#038C48",
  gray50:"#F6F6F6",gray100:"#EBEBEB",gray200:"#D3D3D3",gray400:"#8C8C8C",gray600:"#545454",gray800:"#282828",
  red:"#E11900",redLight:"#FCEAE8",amber:"#FFC043",amberLight:"#FFF3D9",blue:"#276EF1",blueLight:"#EEF3FE",
};
const F = "'Manrope', sans-serif";

/* ════════════════════════════════════════════
   RESPONSIVE HOOK
════════════════════════════════════════════ */
function useBreakpoint() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 768, isTablet: w >= 768 && w < 1024, isDesktop: w >= 1024, width: w };
}

/* ════════════════════════════════════════════
   DATA
════════════════════════════════════════════ */
const NG_STATES={
  "Abia":["Aba North","Aba South","Arochukwu","Bende","Ikwuano","Isiala Ngwa North","Isiala Ngwa South","Isuikwuato","Obi Ngwa","Ohafia","Osisioma Ngwa","Ugwunagbo","Ukwa East","Ukwa West","Umuahia North","Umuahia South","Umu Nneochi"],
  "Adamawa":["Demsa","Fufure","Ganye","Gayuk","Gombi","Grie","Hong","Jada","Lamurde","Madagali","Maiha","Mayo Belwa","Michika","Mubi North","Mubi South","Numan","Shelleng","Song","Toungo","Yola North","Yola South"],
  "Akwa Ibom":["Abak","Eastern Obolo","Eket","Esit Eket","Essien Udim","Etim Ekpo","Etinan","Ibeno","Ibesikpo Asutan","Ibiono-Ibom","Ika","Ikono","Ikot Abasi","Ikot Ekpene","Ini","Itu","Mbo","Mkpat-Enin","Nsit-Atai","Nsit-Ibom","Nsit-Ubium","Obot Akara","Okobo","Onna","Oron","Oruk Anam","Udung-Uko","Ukanafun","Uruan","Urue-Offong/Oruko","Uyo"],
  "Anambra":["Aguata","Anambra East","Anambra West","Anaocha","Awka North","Awka South","Ayamelum","Dunukofia","Ekwusigo","Idemili North","Idemili South","Ihiala","Njikoka","Nnewi North","Nnewi South","Ogbaru","Onitsha North","Onitsha South","Orumba North","Orumba South","Oyi"],
  "Bauchi":["Alkaleri","Bauchi","Bogoro","Damban","Darazo","Dass","Gamawa","Ganjuwa","Giade","Itas/Gadau","Jama'are","Katagum","Kirfi","Misau","Ningi","Shira","Tafawa Balewa","Toro","Warji","Zaki"],
  "Bayelsa":["Brass","Ekeremor","Kolokuma/Opokuma","Nembe","Ogbia","Sagbama","Southern Ijaw","Yenagoa"],
  "Benue":["Ado","Agatu","Apa","Buruku","Gboko","Guma","Gwer East","Gwer West","Katsina-Ala","Konshisha","Kwande","Logo","Makurdi","Obi","Ogbadibo","Ohimini","Oju","Okpokwu","Otukpo","Tarka","Ukum","Ushongo","Vandeikya"],
  "Borno":["Abadam","Askira/Uba","Bama","Bayo","Biu","Chibok","Damboa","Dikwa","Gubio","Guzamala","Gwoza","Hawul","Jere","Kaga","Kala/Balge","Konduga","Kukawa","Kwaya Kusar","Mafa","Magumeri","Maiduguri","Marte","Mobbar","Monguno","Ngala","Nganzai","Shani"],
  "Cross River":["Abi","Akamkpa","Akpabuyo","Bakassi","Bekwarra","Biase","Boki","Calabar Municipal","Calabar South","Etung","Ikom","Obanliku","Obubra","Obudu","Odukpani","Ogoja","Yakuur","Yala"],
  "Delta":["Aniocha North","Aniocha South","Bomadi","Burutu","Ethiope East","Ethiope West","Ika North East","Ika South","Isoko North","Isoko South","Ndokwa East","Ndokwa West","Okpe","Oshimili North","Oshimili South","Patani","Sapele","Udu","Ughelli North","Ughelli South","Ukwuani","Uvwie","Warri North","Warri South","Warri South West"],
  "Ebonyi":["Abakaliki","Afikpo North","Afikpo South","Ebonyi","Ezza North","Ezza South","Ikwo","Ishielu","Ivo","Izzi","Ohaozara","Ohaukwu","Onicha"],
  "Edo":["Akoko-Edo","Egor","Esan Central","Esan North-East","Esan South-East","Esan West","Etsako Central","Etsako East","Etsako West","Igueben","Ikpoba-Okha","Oredo","Orhionmwon","Ovia North-East","Ovia South-West","Owan East","Owan West","Uhunmwonde"],
  "Ekiti":["Ado Ekiti","Efon","Ekiti East","Ekiti South-West","Ekiti West","Emure","Gbonyin","Ido/Osi","Ijero","Ikere","Ikole","Ilejemeje","Irepodun/Ifelodun","Ise/Orun","Moba","Oye"],
  "Enugu":["Aninri","Awgu","Enugu East","Enugu North","Enugu South","Ezeagu","Igbo Etiti","Igbo Eze North","Igbo Eze South","Isi Uzo","Nkanu East","Nkanu West","Nsukka","Oji River","Udenu","Udi","Uzo Uwani"],
  "FCT":["Abaji","Bwari","Gwagwalada","Kuje","Kwali","Municipal Area Council"],
  "Gombe":["Akko","Balanga","Billiri","Dukku","Funakaye","Gombe","Kaltungo","Kwami","Nafada","Shongom","Yamaltu/Deba"],
  "Imo":["Aboh Mbaise","Ahiazu Mbaise","Ehime Mbano","Ezinihitte","Ideato North","Ideato South","Ihitte/Uboma","Ikeduru","Isiala Mbano","Isu","Mbaitoli","Ngor Okpala","Njaba","Nkwerre","Nwangele","Obowo","Oguta","Ohaji/Egbema","Okigwe","Onuimo","Orlu","Orsu","Oru East","Oru West","Owerri Municipal","Owerri North","Owerri West"],
  "Jigawa":["Auyo","Babura","Biriniwa","Birnin Kudu","Buji","Dutse","Gagarawa","Garki","Gumel","Guri","Gwaram","Gwiwa","Hadejia","Jahun","Kafin Hausa","Kaugama","Kazaure","Kiri Kasama","Kiyawa","Maigatari","Malam Madori","Miga","Ringim","Roni","Sule Tankarkar","Taura","Yankwashi"],
  "Kaduna":["Birnin Gwari","Chikun","Giwa","Igabi","Ikara","Jaba","Jema'a","Kachia","Kaduna North","Kaduna South","Kagarko","Kajuru","Kaura","Kauru","Kubau","Kudan","Lere","Makarfi","Sabon Gari","Sanga","Soba","Zangon Kataf","Zaria"],
  "Kano":["Ajingi","Albasu","Bagwai","Bebeji","Bichi","Bunkure","Dala","Dambatta","Dawakin Kudu","Dawakin Tofa","Doguwa","Fagge","Gabasawa","Garko","Garun Mallam","Gaya","Gezawa","Gwale","Gwarzo","Kabo","Kano Municipal","Karaye","Kibiya","Kiru","Kumbotso","Kunchi","Kura","Madobi","Makoda","Minjibir","Nasarawa","Rano","Rimin Gado","Rogo","Shanono","Sumaila","Takai","Tarauni","Tofa","Tsanyawa","Tudun Wada","Ungogo","Warawa","Wudil"],
  "Katsina":["Bakori","Batagarawa","Batsari","Baure","Bindawa","Charanchi","Dandume","Danja","Dan Musa","Daura","Dutsi","Dutsin-Ma","Faskari","Funtua","Ingawa","Jibia","Kafur","Kaita","Kankara","Kankia","Katsina","Kurfi","Kusada","Mai'Adua","Malumfashi","Mani","Mashi","Matazu","Musawa","Rimi","Sabuwa","Safana","Sandamu","Zango"],
  "Kebbi":["Aleiro","Arewa Dandi","Argungu","Augie","Bagudo","Birnin Kebbi","Bunza","Dandi","Fakai","Gwandu","Jega","Kalgo","Koko/Besse","Maiyama","Ngaski","Sakaba","Shanga","Suru","Wasagu/Danko","Yauri","Zuru"],
  "Kogi":["Adavi","Ajaokuta","Ankpa","Bassa","Dekina","Ibaji","Idah","Igalamela-Odolu","Ijumu","Kabba/Bunu","Kogi","Lokoja","Mopa-Muro","Ofu","Ogori/Magongo","Okehi","Okene","Olamaboro","Omala","Yagba East","Yagba West"],
  "Kwara":["Asa","Baruten","Edu","Ekiti","Ifelodun","Ilorin East","Ilorin South","Ilorin West","Irepodun","Isin","Kaiama","Moro","Offa","Oke Ero","Oyun","Pategi"],
  "Lagos":["Agege","Ajeromi-Ifelodun","Alimosho","Amuwo-Odofin","Apapa","Badagry","Epe","Eti-Osa","Ibeju-Lekki","Ifako-Ijaiye","Ikeja","Ikorodu","Kosofe","Lagos Island","Lagos Mainland","Mushin","Ojo","Oshodi-Isolo","Shomolu","Surulere"],
  "Nasarawa":["Akwanga","Awe","Doma","Karu","Keana","Keffi","Kokona","Lafia","Nasarawa","Nasarawa Egon","Obi","Toto","Wamba"],
  "Niger":["Agaie","Agwara","Bida","Borgu","Bosso","Chanchaga","Edati","Gbako","Gurara","Katcha","Kontagora","Lapai","Lavun","Magama","Mariga","Mashegu","Mokwa","Moya","Paikoro","Rafi","Rijau","Shiroro","Suleja","Tafa","Wushishi"],
  "Ogun":["Abeokuta North","Abeokuta South","Ado-Odo/Ota","Egbado North","Egbado South","Ewekoro","Ifo","Ijebu East","Ijebu North","Ijebu North East","Ijebu Ode","Ikenne","Imeko Afon","Ipokia","Obafemi Owode","Odeda","Odogbolu","Ogun Waterside","Remo North","Sagamu"],
  "Ondo":["Akoko North-East","Akoko North-West","Akoko South-East","Akoko South-West","Akure North","Akure South","Ese Odo","Idanre","Ifedore","Ilaje","Ile Oluji/Okeigbo","Irele","Odigbo","Okitipupa","Ondo East","Ondo West","Ose","Owo"],
  "Osun":["Aiyedade","Aiyedire","Atakumosa East","Atakumosa West","Boluwaduro","Boripe","Ede North","Ede South","Egbedore","Ejigbo","Ife Central","Ife East","Ife North","Ife South","Ifedayo","Ifelodun","Ila","Ilesa East","Ilesa West","Irepodun","Irewole","Isokan","Iwo","Obokun","Odo Otin","Ola Oluwa","Olorunda","Oriade","Orolu","Osogbo"],
  "Oyo":["Afijio","Akinyele","Atiba","Atisbo","Egbeda","Ibadan North","Ibadan North-East","Ibadan North-West","Ibadan South-East","Ibadan South-West","Ibarapa Central","Ibarapa East","Ibarapa North","Ido","Irepo","Iseyin","Itesiwaju","Iwajowa","Kajola","Lagelu","Ogbomosho North","Ogbomosho South","Ogo Oluwa","Olorunsogo","Oluyole","Ona Ara","Orelope","Ori Ire","Oyo East","Oyo West","Saki East","Saki West","Surulere"],
  "Plateau":["Barkin Ladi","Bassa","Bokkos","Jos East","Jos North","Jos South","Kanam","Kanke","Langtang North","Langtang South","Mangu","Mikang","Pankshin","Qua'an Pan","Riyom","Shendam","Wase"],
  "Rivers":["Abua/Odual","Ahoada East","Ahoada West","Akuku-Toru","Andoni","Asari-Toru","Bonny","Degema","Eleme","Emohua","Etche","Gokana","Ikwerre","Khana","Obio/Akpor","Ogba/Egbema/Ndoni","Ogu/Bolo","Okrika","Omuma","Opobo/Nkoro","Oyigbo","Port Harcourt","Tai"],
  "Sokoto":["Binji","Bodinga","Dange Shuni","Gada","Goronyo","Gudu","Gwadabawa","Illela","Isa","Kebbe","Kware","Rabah","Sabon Birni","Shagari","Silame","Sokoto North","Sokoto South","Tambuwal","Tangaza","Tureta","Wamako","Wurno","Yabo"],
  "Taraba":["Ardo Kola","Bali","Donga","Gashaka","Gassol","Ibi","Jalingo","Karim Lamido","Kumi","Lau","Sardauna","Takum","Ussa","Wukari","Yorro","Zing"],
  "Yobe":["Bade","Bursari","Damaturu","Fika","Fune","Geidam","Gujba","Gulani","Jakusko","Karasuwa","Machina","Nangere","Nguru","Potiskum","Tarmua","Yunusari","Yusufari"],
  "Zamfara":["Anka","Bakura","Birnin Magaji/Kiyaw","Bukkuyum","Bungudu","Gummi","Gusau","Kaura Namoda","Maradun","Maru","Shinkafi","Talata Mafara","Tsafe","Zurmi"],
};

const DEPOTS = [
  { id:1, name:"Nepal Energies", location:"Apapa, Lagos", pms:795, ago:null, dpk:null, lpg:1040, atk:null, lpfo:855, hpfo:null, stock:61200, cap:85000, rating:4.8, orders:312, slots:5, eta:"4–6h" },
  { id:2, name:"Eterna Plc", location:"Warri, Delta", pms:797, ago:1185, dpk:1330, lpg:1055, atk:1870, lpfo:860, hpfo:790, stock:38400, cap:60000, rating:4.6, orders:198, slots:3, eta:"6–8h" },
  { id:3, name:"Matrix Energy", location:"Port Harcourt, Rivers", pms:800, ago:1190, dpk:1345, lpg:null, atk:1885, lpfo:null, hpfo:785, stock:53200, cap:70000, rating:4.7, orders:241, slots:4, eta:"8–10h" },
  { id:4, name:"MRS Oil", location:"Kano, Kano State", pms:803, ago:1175, dpk:1338, lpg:1048, atk:1892, lpfo:null, hpfo:null, stock:31500, cap:45000, rating:4.5, orders:112, slots:2, eta:"5–7h" },
];
const ORDERS = [
  { id:"VTL-00841", buyer:"Chukwuma Fuels Ltd", depot:"Nepal Energies", product:"PMS", vol:90000, value:71700000, status:"delivered", placed:"Mar 8", trucks:3, progress:100 },
  { id:"VTL-00838", buyer:"Chukwuma Fuels Ltd", depot:"Nepal Energies", product:"PMS", vol:66000, value:52470000, status:"in_transit", placed:"Mar 10", trucks:2, progress:65 },
  { id:"VTL-00835", buyer:"Chukwuma Fuels Ltd", depot:"Eterna Plc", product:"AGO", vol:33000, value:39105000, status:"confirmed", placed:"Mar 10", trucks:1, progress:20 },
];
const INCOMING = [
  { id:"VTL-00844", buyer:"Horizon Petroleum", type:"Petrol Station", products:["PMS","AGO"], product:"PMS + AGO", vol:99000, value:91575000, trucks:3, location:"Ikeja, Lagos", submitted:"7 min ago", slaLeft:"1h 53m", status:"pending" },
  { id:"VTL-00843", buyer:"Horizon Petroleum", type:"Petrol Station", product:"PMS", vol:99000, value:78705000, trucks:3, location:"Ikeja, Lagos", submitted:"12 min ago", slaLeft:"1h 48m", status:"pending" },
  { id:"VTL-00842", buyer:"Skyline Aviation", type:"Aviation", product:"AGO", vol:33000, value:39105000, trucks:1, location:"Murtala Airport", submitted:"34 min ago", slaLeft:"1h 26m", status:"pending" },
  { id:"VTL-00840", buyer:"Femi Oil & Gas", type:"Petrol Station", product:"PMS", vol:66000, value:52470000, trucks:2, location:"Lekki, Lagos", submitted:"2h ago", slaLeft:"Confirmed", status:"confirmed" },
];
const PRICE_HISTORY = [
  {day:"Mar 4",pms:792,ago:1170},{day:"Mar 5",pms:793,ago:1172},{day:"Mar 6",pms:795,ago:1175},
  {day:"Mar 7",pms:794,ago:1174},{day:"Mar 8",pms:797,ago:1180},{day:"Mar 9",pms:800,ago:1185},{day:"Mar 10",pms:795,ago:1185},
];
const REVENUE_DATA = [
  {month:"Oct",revenue:95},{month:"Nov",revenue:124},{month:"Dec",revenue:148},
  {month:"Jan",revenue:167},{month:"Feb",revenue:198},{month:"Mar",revenue:218},
];
const DAILY = [
  {day:"Mon",pms:4,ago:2},{day:"Tue",pms:3,ago:1},{day:"Wed",pms:5,ago:3},
  {day:"Thu",pms:6,ago:2},{day:"Fri",pms:4,ago:4},{day:"Sat",pms:7,ago:1},{day:"Sun",pms:2,ago:0},
];
const SLOTS = [
  {time:"07:00",bay:"Bay 1",order:"VTL-00841",product:"PMS",trucks:3,status:"in_transit"},
  {time:"09:00",bay:"Bay 2",order:"VTL-00839",product:"PMS",trucks:4,status:"loading"},
  {time:"11:00",bay:"Bay 1",order:"VTL-00840",product:"PMS",trucks:2,status:"confirmed"},
  {time:"13:00",bay:"Bay 2",order:"VTL-00842",product:"AGO",trucks:1,status:"pending"},
  {time:"15:00",bay:"Bay 1",order:"—",product:"—",trucks:null,status:"open"},
  {time:"17:00",bay:"Bay 2",order:"—",product:"—",trucks:null,status:"open"},
];
const BUYERS_DATA = [
  {name:"Chukwuma Fuels Ltd",type:"Petrol Station",orders:7,vol:"363k L",spend:"₦280.5M",score:720,tier:"Silver",lastOrder:"Mar 10"},
  {name:"Horizon Petroleum",type:"Petrol Station",orders:5,vol:"215k L",spend:"₦171.3M",score:810,tier:"Gold",lastOrder:"Mar 9"},
  {name:"Silvergate Energy",type:"Petrol Station",orders:4,vol:"396k L",spend:"₦316.5M",score:680,tier:"Silver",lastOrder:"Mar 8"},
  {name:"Skyline Aviation",type:"Aviation",orders:3,vol:"99k L",spend:"₦117.3M",score:760,tier:"Silver",lastOrder:"Mar 7"},
  {name:"Femi Oil & Gas",type:"Petrol Station",orders:2,vol:"66k L",spend:"₦52.5M",score:590,tier:"Bronze",lastOrder:"Mar 5"},
];
const TXN = [
  {id:"TXN-4421",desc:"Wallet Top-up",amount:"+₦150,000,000",date:"Mar 10",type:"credit"},
  {id:"TXN-4420",desc:"Order VTL-00841 — Payment Hold",amount:"-₦71,700,000",date:"Mar 8",type:"debit"},
  {id:"TXN-4419",desc:"Order VTL-00838 — Payment Hold",amount:"-₦52,470,000",date:"Mar 10",type:"debit"},
  {id:"TXN-4418",desc:"Order VTL-00841 — Payment Released",amount:"₦71,700,000",date:"Mar 8",type:"paid"},
];


/* ════════════════════════════════════════════
   ENRICHED ORDER DATA
════════════════════════════════════════════ */
const ORDER_META = {
  "VTL-00841":{
    buyer:{name:"Emeka Chukwuma",company:"Chukwuma Fuels Ltd",type:"Petrol Station",phone:"+234 801 234 5678",email:"emeka@chukwumafuels.ng",location:"Ikeja, Lagos",rc:"RC-1092843"},
    depot:{name:"Nepal Energies",location:"Apapa, Lagos",contact:"Depot Ops · +234 802 345 6789"},
    delivery:{mode:"delivery",state:"Lagos",lga:"Surulere",address:"22 Bode Thomas Street, Surulere"},
    product:"PMS",vol:90000,pricePerLitre:795,value:71700000,trucks:3,
    placed:"Mar 8, 2026 · 09:14",confirmed:"Mar 8, 2026 · 09:52",dispatchDate:"Mar 9, 2026 · 07:00",deliveredDate:"Mar 9, 2026 · 14:30",
    bay:"Bay 1",loadingRef:"LOAD-2026-031",
    trucks_detail:[
      {id:"T1",driver:"Emeka Nwosu",plate:"LSD-481-KJ",vol:33000,departure:"07:00",eta:"12:30",arrivalTime:"12:18",progress:100,status:"delivered"},
      {id:"T2",driver:"Bayo Adeyemi",plate:"LSD-219-AB",vol:33000,departure:"07:05",eta:"12:45",arrivalTime:"13:02",progress:100,status:"delivered"},
      {id:"T3",driver:"Chidi Okonkwo",plate:"LSD-774-QR",vol:24000,departure:"07:10",eta:"13:00",arrivalTime:"13:22",progress:100,status:"delivered"},
    ],
    timeline:[
      {time:"Mar 8 · 09:14",event:"Order placed by Chukwuma Fuels Ltd",actor:"buyer"},
      {time:"Mar 8 · 09:52",event:"Order confirmed by Nepal Energies",actor:"depot"},
      {time:"Mar 8 · 10:20",event:"Bay 1 assigned · Loading ref: LOAD-2026-031",actor:"depot"},
      {time:"Mar 9 · 07:00",event:"3 trucks dispatched from depot",actor:"depot"},
      {time:"Mar 9 · 12:18",event:"Truck 1 (LSD-481-KJ) delivered",actor:"system"},
      {time:"Mar 9 · 13:02",event:"Truck 2 (LSD-219-AB) delivered",actor:"system"},
      {time:"Mar 9 · 13:22",event:"Truck 3 (LSD-774-QR) delivered",actor:"system"},
      {time:"Mar 9 · 14:30",event:"Delivery confirmed · Payment processed",actor:"system"},
    ],
    financials:{productValue:71700000,platformFee:717000,vat:128460,netToDepot:70983000,paymentStatus:"paid"},
  },
  "VTL-00838":{
    buyer:{name:"Emeka Chukwuma",company:"Chukwuma Fuels Ltd",type:"Petrol Station",phone:"+234 801 234 5678",email:"emeka@chukwumafuels.ng",location:"Lekki, Lagos",rc:"RC-1092843"},
    depot:{name:"Nepal Energies",location:"Apapa, Lagos",contact:"Depot Ops · +234 802 345 6789"},
    delivery:{mode:"delivery",state:"Lagos",lga:"Eti-Osa",address:"5 Admiralty Way, Lekki Phase 1"},
    product:"PMS",vol:66000,pricePerLitre:795,value:52470000,trucks:2,
    placed:"Mar 10, 2026 · 10:05",confirmed:"Mar 10, 2026 · 10:47",dispatchDate:"Mar 11, 2026 · 08:00",deliveredDate:null,
    bay:"Bay 2",loadingRef:"LOAD-2026-034",
    trucks_detail:[
      {id:"T1",driver:"Emeka Nwosu",plate:"LSD-481-KJ",vol:33000,departure:"08:00",eta:"13:30",arrivalTime:null,progress:65,status:"in_transit"},
      {id:"T2",driver:"Bayo Adeyemi",plate:"LSD-219-AB",vol:33000,departure:"08:10",eta:"13:45",arrivalTime:null,progress:60,status:"in_transit"},
    ],
    timeline:[
      {time:"Mar 10 · 10:05",event:"Order placed by Chukwuma Fuels Ltd",actor:"buyer"},
      {time:"Mar 10 · 10:47",event:"Order confirmed by Nepal Energies",actor:"depot"},
      {time:"Mar 10 · 11:15",event:"Bay 2 assigned · Loading ref: LOAD-2026-034",actor:"depot"},
      {time:"Mar 11 · 08:00",event:"2 trucks dispatched from depot",actor:"depot"},
      {time:"Mar 11 · 08:00",event:"En route · ETA 13:30 – 13:45",actor:"system"},
    ],
    financials:{productValue:52470000,platformFee:524700,vat:94446,netToDepot:51945300,paymentStatus:"processing"},
  },
  "VTL-00835":{
    buyer:{name:"Emeka Chukwuma",company:"Chukwuma Fuels Ltd",type:"Petrol Station",phone:"+234 801 234 5678",email:"emeka@chukwumafuels.ng",location:"Port Harcourt, Rivers",rc:"RC-1092843"},
    depot:{name:"Eterna Plc",location:"Port Harcourt, Rivers",contact:"Depot Ops · +234 803 456 7890"},
    delivery:{mode:"delivery",state:"Rivers",lga:"Port Harcourt",address:"8 Rumuola Road, Port Harcourt"},
    product:"AGO",vol:33000,pricePerLitre:1185,value:39105000,trucks:1,
    placed:"Mar 10, 2026 · 11:20",confirmed:"Mar 10, 2026 · 12:01",dispatchDate:null,deliveredDate:null,
    bay:null,loadingRef:null,
    trucks_detail:[
      {id:"T1",driver:"TBD",plate:"TBD",vol:33000,departure:"TBD",eta:"TBD",arrivalTime:null,progress:0,status:"confirmed"},
    ],
    timeline:[
      {time:"Mar 10 · 11:20",event:"Order placed by Chukwuma Fuels Ltd",actor:"buyer"},
      {time:"Mar 10 · 12:01",event:"Order confirmed by Eterna Plc",actor:"depot"},
      {time:"Mar 10 · 12:01",event:"Awaiting loading bay assignment",actor:"system"},
    ],
    financials:{productValue:39105000,platformFee:391050,vat:70389,netToDepot:38713950,paymentStatus:"processing"},
  },
  "VTL-00844":{
    buyer:{name:"Tunde Oladele",company:"Horizon Petroleum",type:"Petrol Station",phone:"+234 809 876 5432",email:"ops@horizonpetroleum.ng",location:"Ikeja, Lagos",rc:"RC-0872134"},
    depot:{name:"Nepal Energies",location:"Apapa, Lagos",contact:"Depot Ops · +234 802 345 6789"},
    delivery:{mode:"delivery",state:"Lagos",lga:"Ikeja",address:"14 Allen Avenue, beside Zenith Bank, Ikeja"},
    products:[
      {name:"PMS", fullName:"Premium Motor Spirit", vol:66000, pricePerLitre:795,  value:52470000, trucks:2},
      {name:"AGO", fullName:"Automotive Gas Oil",   vol:33000, pricePerLitre:1185, value:39105000, trucks:1},
    ],
    vol:99000, value:91575000, trucks:3,
    placed:"Today · 09:56",confirmed:null,dispatchDate:null,deliveredDate:null,
    bay:null,loadingRef:null,slaLeft:"1h 53m",
    trucks_detail:[
      {id:"T1",driver:"TBD",plate:"TBD",vol:33000,departure:"TBD",eta:"TBD",arrivalTime:null,progress:0,status:"pending",product:"PMS"},
      {id:"T2",driver:"TBD",plate:"TBD",vol:33000,departure:"TBD",eta:"TBD",arrivalTime:null,progress:0,status:"pending",product:"PMS"},
      {id:"T3",driver:"TBD",plate:"TBD",vol:33000,departure:"TBD",eta:"TBD",arrivalTime:null,progress:0,status:"pending",product:"AGO"},
    ],
    timeline:[
      {time:"Today · 09:56",event:"Multi-product order submitted by Horizon Petroleum",actor:"buyer"},
      {time:"Today · 09:56",event:"Payment initiated · ₦91.6M held in escrow",actor:"system"},
    ],
    financials:{productValue:91575000,platformFee:915750,vat:164835,netToDepot:90659250,paymentStatus:"pending"},
  },
  "VTL-00843":{
    buyer:{name:"Tunde Oladele",company:"Horizon Petroleum",type:"Petrol Station",phone:"+234 809 876 5432",email:"ops@horizonpetroleum.ng",location:"Ikeja, Lagos",rc:"RC-0872134"},
    depot:{name:"Nepal Energies",location:"Apapa, Lagos",contact:"Depot Ops · +234 802 345 6789"},
    delivery:{mode:"delivery",state:"Lagos",lga:"Ikeja",address:"14 Allen Avenue, beside Zenith Bank, Ikeja"},
    product:"PMS",vol:99000,pricePerLitre:795,value:78705000,trucks:3,
    placed:"Today · 09:03",confirmed:null,dispatchDate:null,deliveredDate:null,
    bay:null,loadingRef:null,slaLeft:"1h 48m",
    trucks_detail:[
      {id:"T1",driver:"TBD",plate:"TBD",vol:33000,departure:"TBD",eta:"TBD",arrivalTime:null,progress:0,status:"pending"},
      {id:"T2",driver:"TBD",plate:"TBD",vol:33000,departure:"TBD",eta:"TBD",arrivalTime:null,progress:0,status:"pending"},
      {id:"T3",driver:"TBD",plate:"TBD",vol:33000,departure:"TBD",eta:"TBD",arrivalTime:null,progress:0,status:"pending"},
    ],
    timeline:[
      {time:"Today · 09:03",event:"Order submitted by Horizon Petroleum",actor:"buyer"},
      {time:"Today · 09:03",event:"Payment initiated · ₦78.7M held",actor:"system"},
    ],
    financials:{productValue:78705000,platformFee:787050,vat:141669,netToDepot:77917950,paymentStatus:"pending"},
  },
  "VTL-00842":{
    buyer:{name:"Amaka Obi",company:"Skyline Aviation",type:"Aviation",phone:"+234 808 765 4321",email:"fuel@skylineaviation.ng",location:"Murtala Airport, Lagos",rc:"RC-0543219"},
    depot:{name:"Nepal Energies",location:"Apapa, Lagos",contact:"Depot Ops · +234 802 345 6789"},
    delivery:{mode:"pickup",state:null,lga:null,address:null},
    product:"AGO",vol:33000,pricePerLitre:1185,value:39105000,trucks:1,
    placed:"Today · 08:41",confirmed:null,dispatchDate:null,deliveredDate:null,
    bay:null,loadingRef:null,slaLeft:"1h 26m",
    trucks_detail:[
      {id:"T1",driver:"TBD",plate:"TBD",vol:33000,departure:"TBD",eta:"TBD",arrivalTime:null,progress:0,status:"pending"},
    ],
    timeline:[
      {time:"Today · 08:41",event:"Order submitted by Skyline Aviation",actor:"buyer"},
      {time:"Today · 08:41",event:"Payment initiated · ₦39.1M held",actor:"system"},
    ],
    financials:{productValue:39105000,platformFee:391050,vat:70389,netToDepot:38713950,paymentStatus:"pending"},
  },
};

/* Shared cross-component store for delivery cost negotiation (survives navigation within session) */
const _deliveryQuoteStore = {};

/* Orders placed during the session by the buyer */
const _placedOrdersStore = []; // [{id,buyer,depot,product,vol,value,status,placed,trucks,...,meta:{}}]
let _nextOrderSeq = 845 + Math.floor((Date.now() % 1000000) / 100); // unique per session

/* ── Order lifecycle stores (persist across navigation) ── */
const _orderStatusStore    = {};  // orderId -> status string
const _orderBayStore       = {};  // orderId -> bay string
const _orderTruckListStore = {};  // orderId -> truckList array
const _orderDispatchedStore= {};  // orderId -> boolean
const _orderStatusLogStore = {};  // orderId -> statusLog array
const _gateRecordStore     = {};  // orderId -> {buyerTrucks, waybillRef, gateNote}
const _buyerConfirmedStore = {};  // orderId -> boolean

/* Pre-seed delivery cost negotiations so buyer sees pending quotes */
Object.assign(_deliveryQuoteStore, {
  "VTL-00843":{rounds:[{from:"depot",amount:350000,time:"09:25"}],status:"buyer_pending"},
  "VTL-00844":{rounds:[{from:"depot",amount:520000,time:"10:08"}],status:"buyer_pending"},
  "VTL-00835":{rounds:[{from:"depot",amount:280000,time:"12:15"}],status:"buyer_pending"},
});

/* Pre-seed depot-side confirmed orders so inbox & detail views are populated */
Object.assign(_orderStatusStore, {
  "VTL-00843": "confirmed",   // delivery — awaiting buyer approval of delivery cost quote
  "VTL-00844": "confirmed",   // delivery — awaiting buyer approval of delivery cost quote
  "VTL-00842": "confirmed",   // pickup — bay assigned, ready for loading
  // Buyer-visible orders
  "VTL-00835": "confirmed",   // buyer's confirmed delivery order — delivery cost quote pending
  "VTL-00838": "in_transit",  // buyer's in-transit order — 2 trucks en route
});
Object.assign(_orderBayStore, {
  "VTL-00842": "Bay 3",
  "VTL-00838": "Bay 2",       // buyer can see bay in order detail
});
Object.assign(_orderTruckListStore, {
  "VTL-00838": [
    {id:"T1",driver:"Emeka Nwosu",plate:"LSD-481-KJ",vol:33000,departure:"08:00",eta:"13:30",arrivalTime:null,progress:65,status:"in_transit"},
    {id:"T2",driver:"Bayo Adeyemi",plate:"LSD-219-AB",vol:33000,departure:"08:10",eta:"13:45",arrivalTime:null,progress:60,status:"in_transit"},
  ],
});
Object.assign(_orderDispatchedStore, {
  "VTL-00838": true,
});
Object.assign(_orderStatusLogStore, {
  "VTL-00843": [
    {from:"pending",to:"confirmed",note:"Order confirmed by Nepal Energies",time:"09:12"},
  ],
  "VTL-00844": [
    {from:"pending",to:"confirmed",note:"Order confirmed by Nepal Energies",time:"10:05"},
  ],
  "VTL-00842": [
    {from:"pending",to:"confirmed",note:"Order confirmed by Nepal Energies",time:"08:52"},
  ],
  "VTL-00835": [
    {from:"pending",to:"confirmed",note:"Order confirmed by Eterna Plc",time:"12:01"},
  ],
  "VTL-00838": [
    {from:"pending",to:"confirmed",note:"Order confirmed by Nepal Energies",time:"10:47"},
    {from:"confirmed",to:"loading",note:"Bay 2 assigned · LOAD-2026-034",time:"11:15"},
    {from:"loading",to:"in_transit",note:"2 trucks dispatched from depot",time:"08:00"},
  ],
});

/* Pre-seed one buyer-placed order so both portals show live activity */
_placedOrdersStore.push({
  id:"VTL-00845",
  buyer:"Chukwuma Fuels Ltd",depot:"Nepal Energies",
  product:"PMS",vol:66000,value:52470000,status:"pending",
  placed:"Today · 11:34",trucks:2,progress:0,
  type:"Petrol Station",location:"Eti-Osa, Lagos",submitted:"26 min ago",slaLeft:"1h 34m",
  meta:{
    buyer:{name:"Emeka Chukwuma",company:"Chukwuma Fuels Ltd",type:"Petrol Station",phone:"+234 801 234 5678",email:"emeka@chukwumafuels.ng",location:"Eti-Osa, Lagos",rc:"RC-1092843"},
    depot:{name:"Nepal Energies",location:"Apapa, Lagos",contact:"Depot Ops · +234 802 345 6789"},
    delivery:{mode:"delivery",state:"Lagos",lga:"Eti-Osa",address:"12 Adeola Odeku Street, Victoria Island"},
    product:"PMS",vol:66000,pricePerLitre:795,value:52470000,trucks:2,
    placed:"Today · 11:34",confirmed:null,dispatchDate:null,deliveredDate:null,
    bay:null,loadingRef:null,slaLeft:"1h 34m",
    trucks_detail:[
      {id:"T1",driver:"TBD",plate:"TBD",vol:33000,departure:"TBD",eta:"TBD",arrivalTime:null,progress:0,status:"pending"},
      {id:"T2",driver:"TBD",plate:"TBD",vol:33000,departure:"TBD",eta:"TBD",arrivalTime:null,progress:0,status:"pending"},
    ],
    timeline:[
      {time:"Today · 11:34",event:"Order placed by Chukwuma Fuels Ltd",actor:"buyer"},
      {time:"Today · 11:34",event:"Payment initiated · ₦52.5M held in escrow",actor:"system"},
    ],
    financials:{productValue:52470000,platformFee:524700,vat:94446,netToDepot:51945300,paymentStatus:"pending"},
  },
});

// rounds: [{from:"depot"|"buyer", amount:number, time:string}]
// status: "none" | "buyer_pending" | "depot_pending" | "agreed"

/* ════════════════════════════════════════════
   SHARED COMPONENTS
════════════════════════════════════════════ */
const STATUS_CFG = {
  delivered:{label:"Delivered",bg:T.greenLight,color:T.greenDark},
  in_transit:{label:"In Transit",bg:T.blueLight,color:T.blue},
  confirmed:{label:"Confirmed",bg:T.amberLight,color:"#8A5C00"},
  loading:{label:"Loading",bg:T.gray100,color:T.gray600},
  disputed:{label:"Disputed",bg:T.redLight,color:T.red},
  pending:{label:"Pending",bg:T.gray100,color:T.gray600},
  open:{label:"Available",bg:T.greenLight,color:T.greenDark},
};

function Badge({status}) {
  const c = STATUS_CFG[status]||{label:status,bg:T.gray100,color:T.gray600};
  return <span style={{background:c.bg,color:c.color,fontSize:"11px",fontWeight:700,padding:"3px 8px",borderRadius:"4px",display:"inline-block",whiteSpace:"nowrap"}}>{c.label}</span>;
}

const ChartTip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:T.black,padding:"10px 14px",borderRadius:"6px",fontFamily:F}}>
      <div style={{color:T.gray400,fontSize:"11px",marginBottom:"5px"}}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{color:T.white,fontSize:"12px",fontWeight:700}}>{p.name}: {p.value}</div>)}
    </div>
  );
};

/* Nav icon SVG */
function Icon({d,size=18}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

/* Stat card */
function KpiCard({label,value,sub,alert,accent}) {
  return (
    <div style={{background:T.white,padding:"18px 20px",borderLeft:alert?`3px solid ${T.amber}`:accent?`3px solid ${accent}`:"none"}}>
      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>{label}</div>
      <div style={{fontSize:"24px",fontWeight:800,color:alert?"#8A5C00":T.black,letterSpacing:"-0.02em",lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:"11px",color:T.gray400,marginTop:"5px",fontWeight:600}}>{sub}</div>}
    </div>
  );
}

/* Section header */
function SectionHead({title,sub,right}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"14px",gap:"12px",flexWrap:"wrap"}}>
      <div>
        <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>{title}</div>
        {sub&&<div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{sub}</div>}
      </div>
      {right&&<div style={{flexShrink:0}}>{right}</div>}
    </div>
  );
}

/* Card wrapper */
function Card({children,pad=true,style={}}) {
  return <div style={{border:`1px solid ${T.gray100}`,background:T.white,...(pad?{padding:"20px"}:{}),marginBottom:"14px",...style}}>{children}</div>;
}

/* ════════════════════════════════════════════
   SIDEBAR (desktop) / BOTTOM NAV (mobile)
════════════════════════════════════════════ */
function Sidebar({navItems,active,setActive,identity,portalLabel,isMobile}) {
  if (isMobile) {
    return (
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.black,borderTop:"1px solid #1A1A1A",display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
        {navItems.map(n=>(
          <button key={n.id} onClick={()=>setActive(n.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 4px",background:"none",border:"none",cursor:"pointer",fontFamily:F,color:active===n.id?T.green:"#555",position:"relative",minHeight:"56px"}}>
            {n.badge&&<span style={{position:"absolute",top:"6px",right:"calc(50% - 14px)",background:T.red,color:T.white,fontSize:"9px",fontWeight:800,padding:"1px 4px",borderRadius:"8px",minWidth:"16px",textAlign:"center"}}>{n.badge}</span>}
            <Icon d={n.icon} size={20}/>
            <span style={{fontSize:"9px",fontWeight:700,marginTop:"3px",textTransform:"uppercase",letterSpacing:"0.04em"}}>{n.shortLabel||n.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{width:"210px",background:T.black,minHeight:"100vh",display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh",overflowY:"auto"}}>
      <div style={{padding:"24px 20px 20px",borderBottom:"1px solid #1A1A1A"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div style={{width:"30px",height:"30px",background:T.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>V</span>
          </div>
          <div>
            <div style={{fontSize:"14px",fontWeight:800,color:T.white}}>Ventryl</div>
            <div style={{fontSize:"9px",fontWeight:700,color:portalLabel==="Buyer Portal"?T.green:T.blue,letterSpacing:"0.1em",textTransform:"uppercase"}}>{portalLabel}</div>
          </div>
        </div>
      </div>
      <nav style={{padding:"14px 10px",flex:1}}>
        {navItems.map(n=>(
          <button key={n.id} onClick={()=>setActive(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:"9px",padding:"10px 12px",borderRadius:"5px",background:active===n.id?T.white:"transparent",color:active===n.id?T.black:"#888",border:"none",cursor:"pointer",marginBottom:"2px",fontFamily:F,fontSize:"12px",fontWeight:active===n.id?800:600,textAlign:"left",transition:"all 0.1s"}}>
            <Icon d={n.icon} size={15}/>
            <span style={{flex:1}}>{n.label}</span>
            {n.badge&&<span style={{background:T.red,color:T.white,fontSize:"10px",fontWeight:800,padding:"1px 5px",borderRadius:"10px"}}>{n.badge}</span>}
          </button>
        ))}
      </nav>
      <div style={{padding:"16px 20px",borderTop:"1px solid #1A1A1A"}}>
        <div style={{display:"flex",alignItems:"center",gap:"9px"}}>
          <div style={{width:"30px",height:"30px",background:identity.bg,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:800,color:identity.textColor||T.black,flexShrink:0}}>{identity.initials}</div>
          <div>
            <div style={{fontSize:"11px",fontWeight:800,color:T.white}}>{identity.name}</div>
            <div style={{fontSize:"10px",color:"#666"}}>{identity.role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Top bar */
function Topbar({crumb,pills,isMobile,onMenuToggle,portalLabel}) {
  return (
    <div style={{background:T.white,borderBottom:`1px solid ${T.gray100}`,padding:`0 ${isMobile?"16px":"28px"}`,height:"52px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
      <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
        {isMobile&&(
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginRight:"6px"}}>
            <div style={{width:"22px",height:"22px",background:T.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>V</span>
            </div>
          </div>
        )}
        <span style={{fontSize:"10px",color:T.gray400,fontWeight:600}}>{isMobile?portalLabel:"Platform"}</span>
        <span style={{color:T.gray200}}>›</span>
        <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>{crumb}</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"nowrap"}}>
        {pills?.filter((_,i)=>!isMobile||i<2).map((p,i)=>(
          <div key={i} style={{background:p.bg,color:p.color,fontSize:"10px",fontWeight:800,padding:"3px 8px",borderRadius:"3px",whiteSpace:"nowrap"}}>{p.label}</div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   ORDER FLOW (3-step · multi-product)
════════════════════════════════════════════ */
function OrderFlow({onDone,isMobile}) {
  const [step,setStep]=useState(1);
  const [sel,setSel]=useState(null);
  const [done,setDone]=useState(false);
  const [submittedId,setSubmittedId]=useState(null);
  const [deliveryMode,setDeliveryMode]=useState("delivery"); // "delivery" | "pickup"
  const [pickupNote,setPickupNote]=useState("");
  const [deliveryState,setDeliveryState]=useState("");
  const [deliveryLGA,setDeliveryLGA]=useState("");
  const [deliveryAddress,setDeliveryAddress]=useState("");
  const lgasForState=deliveryState?NG_STATES[deliveryState]||[]:[];

  // products: { PMS: {enabled,vol}, AGO: {enabled,vol}, ... }
  const initProducts=(depot)=>{
    const ps={};
    if(depot.pms) ps["PMS"]={enabled:true,vol:66000,price:depot.pms};
    if(depot.ago) ps["AGO"]={enabled:false,vol:33000,price:depot.ago};
    return ps;
  };
  const [products,setProducts]=useState({});

  const toggleProduct=(name)=>setProducts(p=>({...p,[name]:{...p[name],enabled:!p[name].enabled}}));
  const setVol=(name,v)=>setProducts(p=>({...p,[name]:{...p[name],vol:Number(v)}}));

  const enabledProducts=Object.entries(products).filter(([,p])=>p.enabled);
  const totalTrucks=enabledProducts.reduce((s,[,p])=>s+Math.ceil(p.vol/33000),0);
  const totalValue=enabledProducts.reduce((s,[,p])=>s+(p.price*p.vol),0);
  const deliveryLocationComplete=deliveryMode==="pickup"||(deliveryState&&deliveryLGA&&deliveryAddress.trim());
  const canProceed=sel&&enabledProducts.length>0&&deliveryLocationComplete;

  const handleSelectDepot=(d)=>{
    setSel(d);
    setProducts(initProducts(d));
  };

  if(done) return (
    <div style={{maxWidth:"440px",margin:"32px auto",textAlign:"center",padding:"0 16px"}}>
      <div style={{width:"56px",height:"56px",background:T.greenLight,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px",fontSize:"24px"}}>✓</div>
      <div style={{fontSize:"20px",fontWeight:800,color:T.black,marginBottom:"6px"}}>Order Submitted</div>
      <div style={{fontSize:"13px",color:T.gray400,marginBottom:"24px"}}>{sel?.name} will confirm within 2 hours.</div>
      <div style={{border:`1px solid ${T.gray100}`,marginBottom:"18px",textAlign:"left"}}>
        {[
          ["Order ID",submittedId||"VTL-00845"],
          ["Depot",sel?.name],
          ["Products",enabledProducts.map(([n])=>n).join(" + ")],
          ["Delivery Method",deliveryMode==="delivery"?"🚛 Delivery":"🏭 Self Pick-up"],
          ...(deliveryMode==="delivery"?[
            ["Delivery Address",`${deliveryAddress}, ${deliveryLGA}, ${deliveryState}`],
            ["Est. Arrival",`${sel?.eta} after dispatch`],
          ]:[
            ["Pick-up From",sel?.location],
          ]),
          ["Total Trucks",`${totalTrucks} tanker${totalTrucks!==1?"s":""}`],
          ["Total Value",`₦${totalValue.toLocaleString()}`],
        ].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 18px",borderBottom:`1px solid ${T.gray100}`,fontSize:"13px",gap:"12px"}}>
            <span style={{color:T.gray400,fontWeight:600,flexShrink:0}}>{k}</span>
            <span style={{color:k==="Delivery Method"?(deliveryMode==="delivery"?T.greenDark:T.blue):T.black,fontWeight:800,textAlign:"right"}}>{v}</span>
          </div>
        ))}
        {enabledProducts.map(([name,p])=>(
          <div key={name} style={{display:"flex",justifyContent:"space-between",padding:"10px 18px",borderBottom:`1px solid ${T.gray100}`,fontSize:"12px",background:T.gray50}}>
            <span style={{color:T.gray600,fontWeight:700}}>{name} · {(p.vol/1000).toFixed(0)}k L · {Math.ceil(p.vol/33000)} trucks</span>
            <span style={{color:T.black,fontWeight:800}}>₦{(p.price*p.vol).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <button onClick={onDone} style={{background:T.black,color:T.white,border:"none",padding:"13px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,width:"100%"}}>Back to Dashboard</button>
    </div>
  );

  const stepLabels=["Depot","Products","Review"];
  return (
    <div style={{maxWidth:"680px",margin:"0 auto",padding:isMobile?"0":"0 8px"}}>
      {/* Step indicator */}
      <div style={{display:"flex",alignItems:"center",marginBottom:"28px"}}>
        {stepLabels.map((s,i,arr)=>(
          <div key={s} style={{display:"flex",alignItems:"center",flex:i<arr.length-1?"1":"0"}}>
            <div style={{display:"flex",alignItems:"center",gap:"6px",whiteSpace:"nowrap"}}>
              <div style={{width:"24px",height:"24px",borderRadius:"50%",background:step>i+1?T.green:step===i+1?T.black:T.gray200,color:step>=i+1?T.white:T.gray400,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:800,flexShrink:0,transition:"all 0.2s"}}>{step>i+1?"✓":i+1}</div>
              {!isMobile&&<span style={{fontSize:"12px",fontWeight:700,color:step===i+1?T.black:T.gray400}}>{s}</span>}
            </div>
            {i<arr.length-1&&<div style={{flex:1,height:"2px",background:step>i+1?T.green:T.gray200,margin:"0 8px",transition:"background 0.2s"}}/>}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Choose Depot ── */}
      {step===1&&(
        <div>
          <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"14px"}}>Choose a Depot</div>
          {[...DEPOTS].sort((a,b)=>a.pms-b.pms).map((d,i)=>(
            <div key={d.id} role="button" tabIndex={0} aria-pressed={sel?.id===d.id}
              onClick={()=>handleSelectDepot(d)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")handleSelectDepot(d);}}
              style={{border:`2px solid ${sel?.id===d.id?T.green:T.gray100}`,background:T.white,padding:"16px",cursor:"pointer",marginBottom:"10px",transition:"border-color 0.15s"}}
              onMouseEnter={e=>{if(sel?.id!==d.id)e.currentTarget.style.borderColor=T.gray400}}
              onMouseLeave={e=>{if(sel?.id!==d.id)e.currentTarget.style.borderColor=T.gray100}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:"12px"}}>
                  <div style={{width:"30px",height:"30px",background:i===0?T.green:T.gray100,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:800,color:i===0?T.white:T.gray600,flexShrink:0,marginTop:"2px"}}>{i+1}</div>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                      <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>{d.name}</span>
                      {i===0&&<span style={{background:T.greenLight,color:T.greenDark,fontSize:"9px",fontWeight:800,padding:"2px 6px"}}>BEST PRICE</span>}
                    </div>
                    <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{d.location} · ETA {d.eta} · ★{d.rating} · {d.slots} slots</div>
                    <div style={{display:"flex",gap:"8px",marginTop:"8px",flexWrap:"wrap"}}>
                      <span style={{background:T.gray100,color:T.black,fontSize:"10px",fontWeight:800,padding:"3px 8px"}}>PMS ₦{d.pms}/L</span>
                      {d.ago&&<span style={{background:T.gray100,color:T.black,fontSize:"10px",fontWeight:800,padding:"3px 8px"}}>AGO ₦{d.ago}/L</span>}
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
                  {sel?.id===d.id&&<span style={{fontSize:"18px",color:T.green}}>✓</span>}
                </div>
              </div>
            </div>
          ))}
          <button disabled={!sel} onClick={()=>setStep(2)} style={{background:sel?T.black:T.gray200,color:sel?T.white:T.gray400,border:"none",padding:"14px",fontSize:"13px",fontWeight:800,cursor:sel?"pointer":"not-allowed",fontFamily:F,width:"100%",marginTop:"8px",minHeight:"48px"}}>
            Continue with {sel?.name||"a depot"} →
          </button>
        </div>
      )}

      {/* ── STEP 2: Configure Products ── */}
      {step===2&&(
        <div>
          <button onClick={()=>setStep(1)} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,marginBottom:"16px",padding:0}}>← Back</button>
          <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"6px"}}>Select Products & Volumes</div>
          <div style={{fontSize:"12px",color:T.gray400,marginBottom:"20px"}}>{sel.name} · {sel.location}</div>

          {Object.entries(products).map(([name,p])=>(
            <div key={name} style={{border:`2px solid ${p.enabled?T.black:T.gray100}`,background:T.white,padding:"18px",marginBottom:"12px",transition:"border-color 0.15s"}}>
              {/* Product header row */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:p.enabled?"16px":"0"}}>
                <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                  <button onClick={()=>toggleProduct(name)} style={{width:"20px",height:"20px",background:p.enabled?T.black:T.white,border:`2px solid ${p.enabled?T.black:T.gray400}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,padding:0}}>
                    {p.enabled&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                  </button>
                  <div>
                    <span style={{fontSize:"15px",fontWeight:800,color:T.black}}>{name}</span>
                    <span style={{fontSize:"12px",color:T.gray400,marginLeft:"8px"}}>₦{p.price.toLocaleString()}/L</span>
                  </div>
                </div>
                {p.enabled&&<div style={{textAlign:"right"}}>
                  <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>₦{(p.price*p.vol/1e6).toFixed(2)}M</div>
                  <div style={{fontSize:"10px",color:T.gray400}}>{Math.ceil(p.vol/33000)} truck{Math.ceil(p.vol/33000)!==1?"s":""}</div>
                </div>}
              </div>

              {/* Volume controls (visible when enabled) */}
              {p.enabled&&(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em"}}>Volume</div>
                    <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{(p.vol/1000).toFixed(0)},000 L · {Math.ceil(p.vol/33000)} truck{Math.ceil(p.vol/33000)!==1?"s":""}</div>
                  </div>
                  <input type="range" min={33000} max={198000} step={33000} value={p.vol} onChange={e=>setVol(name,e.target.value)}
                    style={{width:"100%",cursor:"pointer",accentColor:T.black}}/>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:"4px"}}>
                    <span style={{fontSize:"10px",color:T.gray400}}>33k L (1 truck)</span>
                    <span style={{fontSize:"10px",color:T.gray400}}>198k L (6 trucks)</span>
                  </div>
                  {/* Quick-pick truck buttons */}
                  <div style={{display:"flex",gap:"6px",marginTop:"10px",flexWrap:"wrap"}}>
                    {[1,2,3,4,5,6].map(t=>(
                      <button key={t} onClick={()=>setVol(name,t*33000)} style={{padding:"5px 10px",fontSize:"10px",fontWeight:800,cursor:"pointer",fontFamily:F,background:Math.ceil(p.vol/33000)===t?T.black:T.white,color:Math.ceil(p.vol/33000)===t?T.white:T.gray600,border:`1px solid ${Math.ceil(p.vol/33000)===t?T.black:T.gray200}`,minHeight:"30px"}}>
                        {t}T
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* ── Delivery Method ── */}
          {enabledProducts.length>0&&(
            <div style={{marginBottom:"16px"}}>
              <div style={{fontSize:"12px",fontWeight:800,color:T.black,marginBottom:"10px",textTransform:"uppercase",letterSpacing:"0.04em"}}>Delivery Method</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                {[
                  {id:"delivery", icon:"🚛", title:"Delivery", sub:"Depot dispatches trucks to your location"},
                  {id:"pickup",   icon:"🏭", title:"Self Pick-up", sub:"You collect from the depot with your own trucks"},
                ].map(opt=>{
                  const active=deliveryMode===opt.id;
                  return (
                    <div key={opt.id} role="button" tabIndex={0} aria-pressed={active}
                      onClick={()=>setDeliveryMode(opt.id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")setDeliveryMode(opt.id);}}
                      style={{border:`2px solid ${active?T.black:T.gray200}`,background:active?T.black:T.white,padding:"14px 16px",cursor:"pointer",transition:"all 0.15s"}}>
                      <div style={{fontSize:"22px",marginBottom:"6px",lineHeight:1}}>{opt.icon}</div>
                      <div style={{fontSize:"13px",fontWeight:800,color:active?T.white:T.black,marginBottom:"3px"}}>{opt.title}</div>
                      <div style={{fontSize:"10px",color:active?T.gray400:"#999",lineHeight:1.4}}>{opt.sub}</div>
                      {active&&(
                        <div style={{marginTop:"8px",display:"inline-flex",alignItems:"center",gap:"4px",background:T.green,padding:"2px 8px"}}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={T.black} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          <span style={{fontSize:"9px",fontWeight:800,color:T.black}}>SELECTED</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Delivery — location form */}
              {deliveryMode==="delivery"&&(
                <div style={{border:`1px solid ${T.gray100}`,marginTop:"10px"}}>
                  <div style={{padding:"12px 14px",borderBottom:`1px solid ${T.gray100}`,background:T.gray50,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"8px"}}>
                    <div>
                      <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>Delivery Location</div>
                      <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>Trucks will be dispatched to this address</div>
                    </div>
                    {deliveryState&&deliveryLGA&&deliveryAddress.trim()&&(
                      <span style={{background:T.greenLight,color:T.greenDark,fontSize:"10px",fontWeight:800,padding:"3px 8px"}}>✓ Location set</span>
                    )}
                  </div>
                  <div style={{padding:"14px"}}>
                    {/* State */}
                    <div style={{marginBottom:"12px"}}>
                      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>State <span style={{color:T.red}}>*</span></div>
                      <select value={deliveryState} onChange={e=>{setDeliveryState(e.target.value);setDeliveryLGA("");}}
                        style={{width:"100%",border:`1px solid ${deliveryState?T.gray200:T.amber}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:deliveryState?T.black:T.gray400,background:T.white,outline:"none",cursor:"pointer",appearance:"auto"}}>
                        <option value="">Select state…</option>
                        {Object.keys(NG_STATES).sort().map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    {/* LGA */}
                    <div style={{marginBottom:"12px"}}>
                      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>LGA <span style={{color:T.red}}>*</span></div>
                      <select value={deliveryLGA} onChange={e=>setDeliveryLGA(e.target.value)}
                        disabled={!deliveryState}
                        style={{width:"100%",border:`1px solid ${deliveryLGA?T.gray200:deliveryState?T.amber:T.gray100}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:deliveryLGA?T.black:T.gray400,background:deliveryState?T.white:T.gray50,outline:"none",cursor:deliveryState?"pointer":"not-allowed",appearance:"auto",opacity:deliveryState?1:0.6}}>
                        <option value="">{deliveryState?"Select LGA…":"Select state first"}</option>
                        {lgasForState.map(l=><option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    {/* Address */}
                    <div>
                      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Street Address <span style={{color:T.red}}>*</span></div>
                      <textarea value={deliveryAddress} onChange={e=>setDeliveryAddress(e.target.value)}
                        placeholder="e.g. 14 Apapa Road, beside Total filling station"
                        rows={2}
                        style={{width:"100%",border:`1px solid ${deliveryAddress.trim()?T.gray200:deliveryLGA?T.amber:T.gray100}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",color:T.black,outline:"none",resize:"none",boxSizing:"border-box",opacity:deliveryLGA?1:0.6}}
                        disabled={!deliveryLGA}/>
                      {deliveryState&&deliveryLGA&&!deliveryAddress.trim()&&(
                        <div style={{fontSize:"10px",color:T.amber,fontWeight:600,marginTop:"4px"}}>Enter your street address to continue</div>
                      )}
                    </div>
                    {/* ETA strip when complete */}
                    {deliveryState&&deliveryLGA&&deliveryAddress.trim()&&(
                      <div style={{marginTop:"12px",background:T.black,padding:"10px 14px",display:"flex",gap:"24px",flexWrap:"wrap"}}>
                        <div>
                          <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Delivering to</div>
                          <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>{deliveryLGA}, {deliveryState}</div>
                        </div>
                        <div>
                          <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Est. arrival</div>
                          <div style={{fontSize:"12px",fontWeight:800,color:T.green}}>{sel?.eta||"4–6h"} after dispatch</div>
                        </div>
                        <div>
                          <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Trucks</div>
                          <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>{totalTrucks} tanker{totalTrucks!==1?"s":""}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Self pick-up — show depot address + truck note */}
              {deliveryMode==="pickup"&&(
                <div style={{border:`1px solid ${T.gray100}`,marginTop:"10px"}}>
                  <div style={{padding:"12px 14px",borderBottom:`1px solid ${T.gray100}`,display:"flex",gap:"16px",flexWrap:"wrap",background:T.gray50}}>
                    <div>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Pick-up Location</div>
                      <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{sel?.location||"Depot Address"}</div>
                    </div>
                    <div>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Available Slots</div>
                      <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{sel?.slots||"—"} loading bays</div>
                    </div>
                    <div>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Trucks Required</div>
                      <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{totalTrucks} × 33k L tankers</div>
                    </div>
                  </div>
                  <div style={{padding:"12px 14px"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Your Truck Details (optional)</div>
                    <textarea value={pickupNote} onChange={e=>setPickupNote(e.target.value)}
                      placeholder={`e.g. 3 trucks · Plate: LSD-123-AA, LSD-456-BB, LSD-789-CC`}
                      rows={2}
                      style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"12px",color:T.black,outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
                    <div style={{fontSize:"10px",color:T.gray400,marginTop:"4px",fontWeight:600}}>Your truck details will be shared with the depot for gate clearance.</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Order summary strip */}
          {enabledProducts.length>0&&(
            <div style={{background:T.black,padding:"16px 18px",marginBottom:"16px"}}>
              <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(enabledProducts.length+2,4)},1fr)`,gap:"12px",marginBottom:"10px"}}>
                {enabledProducts.map(([name,p])=>(
                  <div key={name}>
                    <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>{name}</div>
                    <div style={{fontSize:"16px",fontWeight:800,color:T.white}}>{(p.vol/1000).toFixed(0)}k L</div>
                  </div>
                ))}
                <div>
                  <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>{deliveryMode==="pickup"?"Your Trucks":"Depot Trucks"}</div>
                  <div style={{fontSize:"16px",fontWeight:800,color:T.white}}>{totalTrucks}</div>
                </div>
                <div>
                  <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Total</div>
                  <div style={{fontSize:"16px",fontWeight:800,color:T.green}}>₦{(totalValue/1e6).toFixed(2)}M</div>
                </div>
              </div>
            </div>
          )}

          <button disabled={!canProceed} onClick={()=>setStep(3)} style={{background:canProceed?T.green:T.gray200,color:canProceed?T.white:T.gray400,border:"none",padding:"14px",fontSize:"13px",fontWeight:800,cursor:canProceed?"pointer":"not-allowed",fontFamily:F,width:"100%",minHeight:"48px"}}>
            Review Order →
          </button>
          {!enabledProducts.length&&<div style={{textAlign:"center",fontSize:"11px",color:T.gray400,marginTop:"8px"}}>Select at least one product to continue</div>}
        </div>
      )}

      {/* ── STEP 3: Review & Pay ── */}
      {step===3&&(
        <div>
          <button onClick={()=>setStep(2)} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,marginBottom:"14px",padding:0}}>← Back</button>
          <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"16px"}}>Review & Pay</div>

          {/* Depot + Delivery summary */}
          <div style={{border:`1px solid ${T.gray100}`,background:T.white,marginBottom:"12px"}}>
            {[
              ["Depot",sel.name],
              ["Depot Location",sel.location],
              ["Delivery Method",deliveryMode==="delivery"?"🚛 Delivery":"🏭 Self Pick-up"],
              ...(deliveryMode==="delivery"?[
                ["Deliver to State",deliveryState],
                ["Deliver to LGA",deliveryLGA],
                ["Street Address",deliveryAddress],
                ["Est. Arrival",`${sel.eta} after dispatch`],
              ]:[
                ["Pick-up Address",sel.location],
                ["Your Trucks",`${totalTrucks} tanker${totalTrucks!==1?"s":""}`],
                ...(pickupNote?[["Truck Details",pickupNote]]:[]),
              ]),
            ].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 18px",borderBottom:`1px solid ${T.gray100}`,fontSize:"13px",gap:"12px"}}>
                <span style={{color:T.gray400,fontWeight:600,flexShrink:0}}>{k}</span>
                <span style={{color:k==="Delivery Method"?(deliveryMode==="delivery"?T.greenDark:T.blue):T.black,fontWeight:700,textAlign:"right"}}>{v}</span>
              </div>
            ))}
          </div>

          {/* Products breakdown */}
          <div style={{border:`1px solid ${T.gray100}`,background:T.white,marginBottom:"12px"}}>
            <div style={{padding:"10px 18px",borderBottom:`1px solid ${T.gray100}`,fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em"}}>Products</div>
            {enabledProducts.map(([name,p])=>(
              <div key={name} style={{padding:"12px 18px",borderBottom:`1px solid ${T.gray100}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                  <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>{name}</span>
                  <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>₦{(p.price*p.vol).toLocaleString()}</span>
                </div>
                <div style={{fontSize:"11px",color:T.gray400}}>{(p.vol/1000).toFixed(0)}k L · ₦{p.price.toLocaleString()}/L · {Math.ceil(p.vol/33000)} truck{Math.ceil(p.vol/33000)!==1?"s":""}</div>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"14px 18px",fontSize:"15px"}}>
              <span style={{fontWeight:800,color:T.black}}>Total</span>
              <span style={{fontWeight:800,color:T.black}}>₦{totalValue.toLocaleString()}</span>
            </div>
          </div>

          {/* Wallet */}
          <div style={{background:T.greenLight,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
            <div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.greenDark,textTransform:"uppercase"}}>Wallet Balance</div>
              <div style={{fontSize:"17px",fontWeight:800,color:T.greenDark}}>₦25,830,000</div>
            </div>
            <div style={{fontSize:"12px",fontWeight:800,color:totalValue>25830000?T.red:T.greenDark}}>{totalValue>25830000?"⚠ Insufficient":"✓ Sufficient"}</div>
          </div>

          <div style={{background:T.gray50,border:`1px solid ${T.gray100}`,padding:"11px 14px",marginBottom:"12px",display:"flex",alignItems:"center",gap:"10px"}}>
            <span style={{fontSize:"16px"}}>{deliveryMode==="delivery"?"🚛":"🏭"}</span>
            <div>
              <div style={{fontSize:"11px",fontWeight:800,color:T.black}}>{deliveryMode==="delivery"?"Delivery selected":"Self Pick-up selected"}</div>
              <div style={{fontSize:"10px",color:T.gray400}}>{deliveryMode==="delivery"?`${totalTrucks} truck${totalTrucks!==1?"s":""} → ${deliveryLGA}, ${deliveryState}`:`You collect from ${sel.location}`}</div>
            </div>
          </div>
          <button onClick={()=>{
            const now=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
            const placed=`Today · ${now}`;
            const orderId=`VTL-00${_nextOrderSeq++}`;
            const productLabel=enabledProducts.map(([n])=>n).join(" + ");
            const totalVol=enabledProducts.reduce((s,[,p])=>s+p.vol,0);
            const pFee=Math.round(totalValue*0.01);
            const vat=Math.round(pFee*0.18);
            const newOrder={
              id:orderId,buyer:"Chukwuma Fuels Ltd",depot:sel.name,
              product:productLabel,vol:totalVol,value:totalValue,status:"pending",
              placed,trucks:totalTrucks,progress:0,
              ...(enabledProducts.length>1?{products:enabledProducts.map(([n])=>n)}:{}),
              type:"Petrol Station",
              location:deliveryMode==="delivery"?`${deliveryLGA}, ${deliveryState}`:sel.location,
              submitted:"Just now",slaLeft:"2h 00m",
              meta:{
                buyer:{name:"Emeka Chukwuma",company:"Chukwuma Fuels Ltd",type:"Petrol Station",phone:"+234 801 234 5678",email:"emeka@chukwumafuels.ng",location:deliveryMode==="delivery"?`${deliveryLGA}, ${deliveryState}`:sel.location,rc:"RC-1092843"},
                depot:{name:sel.name,location:sel.location,contact:"Depot Ops"},
                delivery:deliveryMode==="delivery"?{mode:"delivery",state:deliveryState,lga:deliveryLGA,address:deliveryAddress}:{mode:"pickup"},
                ...(enabledProducts.length>1?{products:enabledProducts.map(([n,p])=>({name:n,fullName:n,vol:p.vol,pricePerLitre:p.price,value:p.price*p.vol,trucks:Math.ceil(p.vol/33000)}))}:{product:enabledProducts[0][0],pricePerLitre:enabledProducts[0][1].price}),
                vol:totalVol,value:totalValue,trucks:totalTrucks,
                placed,confirmed:null,dispatchDate:null,deliveredDate:null,
                bay:null,loadingRef:null,slaLeft:"2h 00m",
                trucks_detail:Array.from({length:totalTrucks},(_,i)=>({id:`T${i+1}`,driver:"TBD",plate:"TBD",vol:33000,departure:"TBD",eta:"TBD",arrivalTime:null,progress:0,status:"pending"})),
                timeline:[
                  {time:placed,event:"Order placed by Chukwuma Fuels Ltd",actor:"buyer"},
                  {time:placed,event:`Payment initiated · ₦${(totalValue/1e6).toFixed(1)}M held in escrow`,actor:"system"},
                ],
                financials:{productValue:totalValue,platformFee:pFee,vat,netToDepot:totalValue-pFee,paymentStatus:"pending"},
              },
            };
            _placedOrdersStore.push(newOrder);
            setSubmittedId(orderId);
            setDone(true);
          }} disabled={totalValue>25830000} style={{background:totalValue>25830000?T.gray200:T.green,color:totalValue>25830000?T.gray400:T.white,border:"none",padding:"14px",fontSize:"14px",fontWeight:800,cursor:totalValue>25830000?"not-allowed":"pointer",fontFamily:F,width:"100%",minHeight:"48px"}}>
            Confirm & Pay ₦{totalValue.toLocaleString()}
          </button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   BUYER VIEWS/* ════════════════════════════════════════════
   BUYER VIEWS
════════════════════════════════════════════ */
function BuyerDash({onOrder,isMobile}) {
  const col2 = isMobile ? "1fr" : "1fr 1.3fr";
  return (
    <div>
      {/* Hero */}
      <div style={{background:T.black,padding:isMobile?"18px 16px":"24px 28px",marginBottom:"14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
          <div>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"4px"}}>Buyer Dashboard</div>
            <div style={{fontSize:isMobile?"20px":"24px",fontWeight:800,color:T.white}}>Chukwuma Fuels Ltd</div>
            <div style={{fontSize:"11px",color:T.gray400,marginTop:"3px"}}>RC-1092843 · Lagos · KYB ✓</div>
          </div>
          <div style={{textAlign:isMobile?"left":"right"}}>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"3px"}}>Wallet Balance</div>
            <div style={{fontSize:isMobile?"22px":"28px",fontWeight:800,color:T.green}}>₦25,830,000</div>
            <button style={{marginTop:"8px",background:T.green,color:T.black,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>+ Fund Wallet</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:"1px",background:T.gray100,border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
        {[{l:"Orders MTD",v:"7",sub:"3 delivered"},{l:"Volume",v:"363k L",sub:"₦280.5M"},{l:"Avg. Price",v:"₦795/L",sub:"PMS · Mar"},{l:"Credit (VCS)",v:"720",sub:"Silver tier"}].map(k=>(
          <KpiCard key={k.l} label={k.l} value={k.v} sub={k.sub}/>
        ))}
      </div>

      {/* Active orders + chart */}
      <div style={{display:"grid",gridTemplateColumns:col2,gap:"14px",marginBottom:"14px"}}>
        <Card pad={false}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.gray100}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>Active Orders</div>
          </div>
          {ORDERS.filter(o=>o.status!=="delivered").map((o,i,arr)=>(
            <div key={o.id} style={{padding:"13px 18px",borderBottom:i<arr.length-1?`1px solid ${T.gray100}`:"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"7px",gap:"8px"}}>
                <div>
                  <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{o.id}</div>
                  <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>{o.depot} · {o.product} · {(o.vol/1000).toFixed(0)}k L</div>
                </div>
                <Badge status={o.status}/>
              </div>
              <div style={{height:"4px",background:T.gray100,borderRadius:"2px",overflow:"hidden"}}>
                <div style={{height:"100%",width:`${o.progress}%`,background:o.status==="in_transit"?T.blue:T.amber,borderRadius:"2px"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:"4px"}}>
                <span style={{fontSize:"10px",color:T.gray400}}>{o.progress}% done</span>
                <span style={{fontSize:"10px",color:T.gray400,fontWeight:600}}>₦{(o.value/1e6).toFixed(1)}M</span>
              </div>
            </div>
          ))}
          <div style={{padding:"12px 18px"}}>
            <button onClick={onOrder} style={{width:"100%",background:T.black,color:T.white,border:"none",padding:"11px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>+ Place New Order</button>
          </div>
        </Card>

        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"12px",flexWrap:"wrap",gap:"8px"}}>
            <div>
              <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>Price Trend — 7 Days</div>
              <div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>₦/Litre · PMS & AGO</div>
            </div>
            <div style={{background:T.amberLight,color:"#8A5C00",fontSize:"10px",fontWeight:800,padding:"4px 8px"}}>📈 Rising next week</div>
          </div>
          <ResponsiveContainer width="100%" height={isMobile?150:180}>
            <LineChart data={PRICE_HISTORY} margin={{top:4,right:0,bottom:0,left:-24}}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.gray100}/>
              <XAxis dataKey="day" tick={{fill:T.gray400,fontSize:9,fontFamily:F,fontWeight:600}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:T.gray400,fontSize:9,fontFamily:F,fontWeight:600}} axisLine={false} tickLine={false} domain={[780,810]}/>
              <Tooltip content={<ChartTip/>}/>
              <Line type="monotone" dataKey="pms" stroke={T.green} strokeWidth={2.5} name="PMS" dot={{fill:T.green,r:3,strokeWidth:0}}/>
              <Line type="monotone" dataKey="ago" stroke={T.blue} strokeWidth={2} name="AGO" dot={{fill:T.blue,r:3,strokeWidth:0}} strokeDasharray="5 3"/>
            </LineChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:"12px",marginTop:"10px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"5px"}}><div style={{width:"10px",height:"2px",background:T.green}}/><span style={{fontSize:"10px",fontWeight:600,color:T.gray400}}>PMS ₦795</span></div>
            <div style={{display:"flex",alignItems:"center",gap:"5px"}}><div style={{width:"10px",height:"2px",background:T.blue}}/><span style={{fontSize:"10px",fontWeight:600,color:T.gray400}}>AGO ₦1,185</span></div>
          </div>
        </Card>
      </div>

      {/* Order history - cards on mobile */}
      <Card pad={false}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.gray100}`}}><div style={{fontSize:"13px",fontWeight:800,color:T.black}}>Order History</div></div>
        {isMobile?(
          ORDERS.map((o,i)=>(
            <div key={o.id} style={{padding:"14px 18px",borderBottom:i<ORDERS.length-1?`1px solid ${T.gray100}`:"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
                <div>
                  <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{o.id}</div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{o.depot} · {o.product}</div>
                </div>
                <Badge status={o.status}/>
              </div>
              <div style={{display:"flex",gap:"16px"}}>
                <span style={{fontSize:"11px",color:T.gray600,fontWeight:700}}>{(o.vol/1000).toFixed(0)}k L</span>
                <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>₦{(o.value/1e6).toFixed(1)}M</span>
                <span style={{fontSize:"11px",color:T.gray400}}>{o.placed}</span>
              </div>
            </div>
          ))
        ):(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${T.gray100}`}}>{["Order","Depot","Product","Volume","Value","Placed","Status"].map(h=><th key={h} style={{padding:"9px 18px",fontFamily:F,fontSize:"10px",fontWeight:700,color:T.gray400,textAlign:"left",textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>)}</tr></thead>
            <tbody>{ORDERS.map((o,i)=>(
              <tr key={o.id} style={{borderBottom:i<ORDERS.length-1?`1px solid ${T.gray100}`:"none"}}>
                <td style={{padding:"12px 18px",fontFamily:F,fontSize:"12px",fontWeight:800,color:T.black}}>{o.id}</td>
                <td style={{padding:"12px 18px",fontFamily:F,fontSize:"12px",color:T.gray800}}>{o.depot}</td>
                <td style={{padding:"12px 18px"}}><span style={{background:T.gray100,color:T.black,fontSize:"10px",fontWeight:800,padding:"3px 7px"}}>{o.product}</span></td>
                <td style={{padding:"12px 18px",fontFamily:F,fontSize:"12px",color:T.gray600}}>{(o.vol/1000).toFixed(0)}k L</td>
                <td style={{padding:"12px 18px",fontFamily:F,fontSize:"13px",fontWeight:800,color:T.black}}>₦{(o.value/1e6).toFixed(1)}M</td>
                <td style={{padding:"12px 18px",fontFamily:F,fontSize:"11px",color:T.gray400}}>{o.placed}</td>
                <td style={{padding:"12px 18px"}}><Badge status={o.status}/></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function BuyerMarketplace({onOrder,isMobile}) {
  const [sort,setSort]=useState("price");
  const {marketDepots,marketDepotsLoaded,loadMarketDepots}=useVentrylStore();
  useEffect(()=>{if(!marketDepotsLoaded)loadMarketDepots();},[]);
  const source=marketDepotsLoaded&&marketDepots.length?marketDepots:DEPOTS;
  const sorted=[...source].filter(d=>d.pms!=null||d.ago!=null).sort((a,b)=>sort==="price"?(a.pms??9999)-(b.pms??9999):sort==="rating"?b.rating-a.rating:b.stock-a.stock);
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}}>
        <div><div style={{fontSize:"14px",fontWeight:800,color:T.black}}>Price Discovery</div><div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{sorted.length} depot{sorted.length!==1?"s":""} · NMDPRA verified</div></div>
        <div style={{display:"flex",gap:"6px"}}>
          {["price","rating","stock"].map(s=>(
            <button key={s} onClick={()=>setSort(s)} style={{background:sort===s?T.black:T.white,color:sort===s?T.white:T.gray600,border:`1px solid ${sort===s?T.black:T.gray200}`,padding:"5px 10px",fontSize:"10px",fontWeight:700,cursor:"pointer",fontFamily:F,borderRadius:"20px",textTransform:"capitalize"}}>{s}</button>
          ))}
        </div>
      </div>
      {sorted.map((d,i)=>(
        <div key={d.id} style={{border:`1px solid ${T.gray100}`,background:T.white,padding:"16px",marginBottom:"10px"}}>
          {isMobile?(
            <>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"10px",gap:"10px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:"10px"}}>
                  <div style={{width:"30px",height:"30px",background:i===0&&sort==="price"?T.green:T.gray100,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:800,color:i===0&&sort==="price"?T.white:T.gray600,flexShrink:0}}>{i+1}</div>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                      <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>{d.name}</span>
                      {i===0&&sort==="price"&&<span style={{background:T.greenLight,color:T.greenDark,fontSize:"9px",fontWeight:800,padding:"1px 5px"}}>BEST</span>}
                    </div>
                    <div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>{d.location} · ★{d.rating} · {d.slots} slots</div>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:"18px",fontWeight:800,color:i===0&&sort==="price"?T.green:T.black}}>₦{d.pms}/L</div>
                  {d.ago&&<div style={{fontSize:"10px",color:T.gray400}}>AGO ₦{d.ago.toLocaleString()}</div>}
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"10px"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"3px"}}>Stock: {(d.stock/1000).toFixed(0)}k/{(d.cap/1000).toFixed(0)}k MT</div>
                  <div style={{height:"4px",background:T.gray100,borderRadius:"2px",overflow:"hidden"}}><div style={{height:"100%",width:`${Math.round(d.stock/d.cap*100)}%`,background:T.green}}/></div>
                </div>
                <button onClick={onOrder} style={{background:T.black,color:T.white,border:"none",padding:"9px 16px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px",flexShrink:0}}>Order →</button>
              </div>
            </>
          ):(
            <div style={{display:"flex",alignItems:"center",gap:"16px"}}>
              <div style={{width:"36px",height:"36px",background:i===0&&sort==="price"?T.green:T.gray100,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:800,color:i===0&&sort==="price"?T.white:T.gray600,flexShrink:0}}>{i+1}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"3px"}}>
                  <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>{d.name}</span>
                  <span style={{background:T.greenLight,color:T.greenDark,fontSize:"9px",fontWeight:700,padding:"2px 6px"}}>NMDPRA ✓</span>
                </div>
                <div style={{fontSize:"11px",color:T.gray400}}>{d.location} · ★{d.rating} ({d.orders} orders) · {d.slots} slots · ETA {d.eta}</div>
              </div>
              <div style={{display:"flex",gap:"16px",alignItems:"center"}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>PMS</div><div style={{fontSize:"18px",fontWeight:800,color:T.black}}>₦{d.pms}</div></div>
                {d.ago&&<div style={{textAlign:"center"}}><div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>AGO</div><div style={{fontSize:"18px",fontWeight:800,color:T.black}}>₦{d.ago.toLocaleString()}</div></div>}
                <div>
                  <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"4px"}}>Stock</div>
                  <div style={{height:"4px",background:T.gray100,borderRadius:"2px",overflow:"hidden",width:"70px"}}><div style={{height:"100%",width:`${Math.round(d.stock/d.cap*100)}%`,background:T.green}}/></div>
                  <div style={{fontSize:"9px",color:T.gray400,marginTop:"2px"}}>{(d.stock/1000).toFixed(0)}k/{(d.cap/1000).toFixed(0)}k MT</div>
                </div>
                <button onClick={onOrder} style={{background:T.black,color:T.white,border:"none",padding:"9px 16px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px"}}>Order →</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BuyerWallet({isMobile}) {
  const {user:authUser,profile:authProfile}=useAuthStore();
  const {walletNGN,loadWallet}=useVentrylStore();
  useEffect(()=>{if(authUser?.id)loadWallet(authUser.id);},[authUser?.id]);
  const [currency,setCurrency]=useState("NGN");
  const [showFund,setShowFund]=useState(false);
  const [showWithdraw,setShowWithdraw]=useState(false);
  const [fundAmt,setFundAmt]=useState("");
  const [fundDone,setFundDone]=useState(false);
  const [fundErr,setFundErr]=useState("");
  const [fundLoading,setFundLoading]=useState(false);
  const [withdrawAmt,setWithdrawAmt]=useState("");
  const [withdrawDone,setWithdrawDone]=useState(false);

  const handlePaystackFund=async()=>{
    const amt=parseInt(fundAmt);
    if(!amt||amt<1000){setFundErr("Minimum top-up is ₦1,000");return;}
    if(!authUser||!authProfile?.email){setFundErr("Please complete your profile before topping up.");return;}
    setFundLoading(true);
    setFundErr("");
    try{
      await openPaystackPopup({
        email:authProfile.email,
        amountKobo:amt*100,
        metadata:{"user_id":authUser.id,"purpose":"wallet_topup"},
        onSuccess:async(response)=>{
          try{
            await verifyAndCreditWallet(response.reference,authUser.id);
            await loadWallet(authUser.id);
            setFundDone(true);
          }catch(e){
            setFundErr(e.message||"Payment verified but wallet credit failed. Contact support.");
          }finally{
            setFundLoading(false);
          }
        },
        onClose:()=>{setFundLoading(false);},
      });
    }catch(e){
      setFundErr(e.message||"Payment failed");
      setFundLoading(false);
    }
  };

  const CURRENCIES={
    NGN:{symbol:"₦",label:"Nigerian Naira",balance:walletNGN?.balanceNGN??0,fmt:(n)=>`₦${n.toLocaleString('en-NG')}`,rate:null,flag:"🇳🇬",
      txn:walletNGN?.txn??[],},
    USD:{symbol:"$",label:"US Dollar",balance:15770.42,fmt:(n)=>`$${n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,rate:"1 USD = ₦1,638",flag:"🇺🇸",
      txn:[
        {id:"TXN-D421",desc:"Wallet Funding (Bank Transfer)",amount:"+$10,000.00",date:"Mar 10",type:"credit"},
        {id:"TXN-D418",desc:"Order VTL-00841 — Payment",amount:"-$43,772.00",date:"Mar 8",type:"debit"},
      ]},
    USDT:{symbol:"",label:"Tether (USDT)",balance:15770.42,fmt:(n)=>`${n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} USDT`,rate:"1 USDT ≈ $1.00",flag:"₮",
      txn:[
        {id:"TXN-U421",desc:"USDT Deposit (On-chain)",amount:"+10,000 USDT",date:"Mar 10",type:"credit"},
        {id:"TXN-U420",desc:"Order VTL-00840 (converted to NGN)",amount:"-23,872.14 USDT",date:"Mar 9",type:"debit"},
      ]},
  };

  const cur=CURRENCIES[currency];
  const TABS=["NGN","USD","USDT"];

  return (
    <div>
      {/* Hero header */}
      <div style={{background:T.black,padding:isMobile?"18px 16px":"24px 28px",marginBottom:"14px"}}>
        {/* Currency tabs */}
        <div style={{display:"flex",gap:"0",marginBottom:"20px",borderBottom:"1px solid #222"}}>
          {TABS.map(tab=>(
            <button key={tab} onClick={()=>setCurrency(tab)} style={{padding:"8px 16px",background:"none",border:"none",cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:currency===tab?800:600,color:currency===tab?T.white:"#666",borderBottom:`2px solid ${currency===tab?T.green:"transparent"}`,marginBottom:"-1px",transition:"all 0.15s"}}>
              {CURRENCIES[tab].flag} {tab}
            </button>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"24px"}}>
          <div>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"6px"}}>Available Balance · {cur.label}</div>
            <div style={{fontSize:isMobile?"28px":"36px",fontWeight:800,color:T.green,letterSpacing:"-0.02em",lineHeight:1}}>{cur.fmt(cur.balance)}</div>
            {cur.rate&&<div style={{fontSize:"11px",color:"#888",marginTop:"5px"}}>{cur.rate}</div>}
            <div style={{display:"flex",gap:"10px",marginTop:"16px"}}>
              <button onClick={()=>{setShowFund(true);setFundDone(false);setFundAmt("");}} style={{background:T.green,color:T.black,border:"none",padding:"9px 16px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px"}}>+ Fund</button>
              <button onClick={()=>{setShowWithdraw(true);setWithdrawDone(false);setWithdrawAmt("");}} style={{background:"transparent",color:T.white,border:"1px solid #333",padding:"9px 16px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px"}}>Withdraw</button>
              {currency!=="NGN"&&<button style={{background:"transparent",color:T.white,border:"1px solid #333",padding:"9px 16px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px"}}>Convert</button>}
            </div>
          </div>
          {/* Active orders summary */}
          <div>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"10px"}}>Active Orders</div>
            {ORDERS.filter(o=>o.status!=="delivered").map(o=>(
              <div key={o.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #1A1A1A",fontSize:"12px"}}>
                <div><span style={{color:T.white,fontWeight:700}}>{o.id}</span><span style={{color:T.gray400,marginLeft:"6px"}}>{o.product}</span></div>
                <Badge status={o.status}/>
              </div>
            ))}
            {ORDERS.filter(o=>o.status!=="delivered").length===0&&<div style={{fontSize:"12px",color:"#555"}}>No active orders</div>}
          </div>
        </div>
      </div>

      {/* Balances across currencies */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1px",background:T.gray100,border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
        {TABS.map(tab=>(
          <div key={tab} onClick={()=>setCurrency(tab)} style={{background:currency===tab?T.black:T.white,padding:"16px 18px",cursor:"pointer",transition:"background 0.15s"}}>
            <div style={{fontSize:"10px",fontWeight:700,color:currency===tab?T.gray400:"#8C8C8C",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>{CURRENCIES[tab].flag} {tab}</div>
            <div style={{fontSize:"16px",fontWeight:800,color:currency===tab?T.green:T.black,lineHeight:1}}>{CURRENCIES[tab].fmt(CURRENCIES[tab].balance)}</div>
            {CURRENCIES[tab].rate&&<div style={{fontSize:"9px",color:currency===tab?"#666":T.gray400,marginTop:"3px"}}>{CURRENCIES[tab].rate}</div>}
          </div>
        ))}
      </div>

      {/* Transaction history */}
      <Card pad={false}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.gray100}`,display:"flex",alignItems:"center",gap:"8px"}}>
          <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>Transaction History</div>
          <span style={{background:T.gray100,color:T.gray600,fontSize:"10px",fontWeight:700,padding:"2px 7px"}}>{cur.label}</span>
        </div>
        {cur.txn.map((t,i)=>(
          <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 18px",borderBottom:i<cur.txn.length-1?`1px solid ${T.gray100}`:"none",gap:"10px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <div style={{width:"32px",height:"32px",background:t.type==="credit"?T.greenLight:t.type==="paid"?T.blueLight:T.gray100,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",flexShrink:0}}>
                {t.type==="credit"?"↓":t.type==="paid"?"✓":"↑"}
              </div>
              <div>
                <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{isMobile?t.desc.split("—")[0]:t.desc}</div>
                <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>{t.id} · {t.date}</div>
              </div>
            </div>
            <div style={{fontSize:"13px",fontWeight:800,color:t.type==="credit"?T.greenDark:t.type==="paid"?T.blue:T.black,flexShrink:0}}>{t.amount}</div>
          </div>
        ))}
      </Card>

      {/* Fund modal */}
      {showFund&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{background:T.white,maxWidth:"420px",width:"100%",padding:"28px"}}>
            {fundDone?(
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:"32px",marginBottom:"14px"}}>✓</div>
                <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"8px"}}>Wallet Funded!</div>
                <div style={{fontSize:"12px",color:T.gray400,marginBottom:"20px"}}>Your NGN wallet has been credited. Balance will refresh on next login if not shown immediately.</div>
                <button onClick={()=>{setShowFund(false);setFundDone(false);setFundAmt("");}} style={{background:T.black,color:T.white,border:"none",padding:"11px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,width:"100%"}}>Done</button>
              </div>
            ):(
              <>
                <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"4px"}}>Fund NGN Wallet</div>
                <div style={{fontSize:"11px",color:T.gray400,marginBottom:"18px"}}>Secure payment via Paystack · Instant credit</div>
                {/* Quick presets */}
                <div style={{display:"flex",flexWrap:"wrap",gap:"7px",marginBottom:"14px"}}>
                  {FUND_PRESETS.map(p=>(
                    <button key={p.label} onClick={()=>setFundAmt(String(p.naira))}
                      style={{background:fundAmt===String(p.naira)?T.black:T.white,color:fundAmt===String(p.naira)?T.white:T.black,border:`1px solid ${fundAmt===String(p.naira)?T.black:T.gray200}`,padding:"6px 12px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F}}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Custom Amount (NGN)</div>
                <input type="number" value={fundAmt} onChange={e=>{setFundAmt(e.target.value);setFundErr("");}}
                  placeholder="e.g. 5000000"
                  style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"12px 14px",fontFamily:F,fontSize:"15px",fontWeight:700,color:T.black,outline:"none",marginBottom:"10px",boxSizing:"border-box"}}/>
                {fundErr&&<div style={{fontSize:"11px",color:T.red,fontWeight:600,marginBottom:"10px"}}>{fundErr}</div>}
                <div style={{background:T.gray50,padding:"10px 14px",fontSize:"11px",color:T.gray400,marginBottom:"16px",lineHeight:1.5}}>
                  You will be redirected to Paystack's secure checkout. Your card/bank details are never stored on Ventryl.
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  <button
                    onClick={currency==="NGN"?handlePaystackFund:()=>setFundDone(true)}
                    disabled={!fundAmt||fundLoading}
                    style={{flex:1,background:fundAmt&&!fundLoading?T.green:T.gray200,color:fundAmt&&!fundLoading?T.white:T.gray400,border:"none",padding:"11px",fontSize:"13px",fontWeight:800,cursor:fundAmt&&!fundLoading?"pointer":"not-allowed",fontFamily:F,minHeight:"44px"}}>
                    {fundLoading?"Opening Paystack…":currency==="NGN"?"Pay with Paystack →":"Confirm"}
                  </button>
                  <button onClick={()=>{setShowFund(false);setFundErr("");setFundAmt("");}} style={{flex:1,background:"none",color:T.black,border:`1px solid ${T.gray200}`,padding:"11px",fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Withdraw modal */}
      {showWithdraw&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{background:T.white,maxWidth:"400px",width:"100%",padding:"28px"}}>
            {withdrawDone?(
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:"32px",marginBottom:"14px"}}>✓</div>
                <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"8px"}}>Withdrawal Submitted</div>
                <div style={{fontSize:"12px",color:T.gray400,marginBottom:"20px"}}>Processing within 1 business day. You'll receive a confirmation SMS.</div>
                <button onClick={()=>setShowWithdraw(false)} style={{background:T.black,color:T.white,border:"none",padding:"11px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,width:"100%"}}>Done</button>
              </div>
            ):(
              <>
                <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"4px"}}>Withdraw {cur.label}</div>
                <div style={{fontSize:"11px",color:T.gray400,marginBottom:"20px"}}>Available: {cur.fmt(cur.balance)}</div>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Amount ({currency})</div>
                <input type="number" value={withdrawAmt} onChange={e=>setWithdrawAmt(e.target.value)} placeholder="Enter amount"
                  style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"12px 14px",fontFamily:F,fontSize:"15px",fontWeight:700,color:T.black,outline:"none",marginBottom:"16px"}}/>
                <div style={{background:T.gray50,padding:"10px 14px",fontSize:"11px",color:T.gray400,marginBottom:"20px"}}>
                  {currency==="NGN"&&"To: GTBank · 0081 234 567 · Chukwuma Fuels"}
                  {currency==="USD"&&"To: Chase · Account ending 4321"}
                  {currency==="USDT"&&"To: TRC-20 wallet · Paste your address below"}
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  <button onClick={()=>setWithdrawDone(true)} disabled={!withdrawAmt} style={{flex:1,background:withdrawAmt?T.black:T.gray200,color:withdrawAmt?T.white:T.gray400,border:"none",padding:"11px",fontSize:"13px",fontWeight:800,cursor:withdrawAmt?"pointer":"not-allowed",fontFamily:F,minHeight:"44px"}}>Withdraw</button>
                  <button onClick={()=>setShowWithdraw(false)} style={{flex:1,background:"none",color:T.black,border:`1px solid ${T.gray200}`,padding:"11px",fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   DEPOT VIEWS/* ════════════════════════════════════════════
   DEPOT VIEWS
════════════════════════════════════════════ */
function DepotDash({isMobile}) {
  const [pms,setPms]=useState(795);
  const [ago,setAgo]=useState(1185);
  const [editing,setEditing]=useState(false);
  const col2=isMobile?"1fr":"1fr 1fr";
  return (
    <div>
      <div style={{background:T.black,padding:isMobile?"18px 16px":"24px 28px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
        <div>
          <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"4px"}}>Depot Dashboard</div>
          <div style={{fontSize:isMobile?"20px":"24px",fontWeight:800,color:T.white}}>Nepal Energies</div>
          <div style={{fontSize:"11px",color:T.gray400,marginTop:"3px"}}>Apapa, Lagos · NMDPRA: MDP/D/0042</div>
        </div>
        <div style={{textAlign:isMobile?"left":"right"}}>
          <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"3px"}}>Revenue (Mar)</div>
          <div style={{fontSize:isMobile?"22px":"28px",fontWeight:800,color:T.green}}>₦218M</div>
          <div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>+10.1% vs Feb</div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:"1px",background:T.gray100,border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
        <KpiCard label="Orders MTD" value="34" sub="28 fulfilled"/>
        <KpiCard label="Volume" value="1.12M L" sub="34 trucks"/>
        <KpiCard label="Pending" value="2" sub="SLA: 2h max" alert/>
        <KpiCard label="Avg. Rating" value="4.8 ★" sub="34 reviews"/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:col2,gap:"14px",marginBottom:"14px"}}>
        {/* Price Control */}
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
            <div><div style={{fontSize:"13px",fontWeight:800,color:T.black}}>Live Price Control</div><div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>Updates marketplace instantly</div></div>
            <button onClick={()=>setEditing(!editing)} style={{background:editing?T.green:T.black,color:T.white,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>{editing?"Save":"Edit"}</button>
          </div>
          {[{label:"PMS",val:pms,set:setPms},{label:"AGO",val:ago,set:setAgo}].map(p=>(
            <div key={p.label} style={{marginBottom:"12px",paddingBottom:"12px",borderBottom:`1px solid ${T.gray100}`}}>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"7px"}}>{p.label}</div>
              {editing?(
                <div style={{display:"flex",alignItems:"center",border:`2px solid ${T.black}`}}>
                  <span style={{padding:"9px 10px",fontSize:"12px",fontWeight:700,color:T.gray400,borderRight:`1px solid ${T.gray100}`}}>₦</span>
                  <input type="number" value={p.val} onChange={e=>p.set(Number(e.target.value))} style={{flex:1,border:"none",padding:"9px 10px",fontSize:"16px",fontWeight:800,fontFamily:F,outline:"none",color:T.black,width:"100%"}}/>
                  <span style={{padding:"9px 10px",fontSize:"11px",fontWeight:600,color:T.gray400}}>/L</span>
                </div>
              ):(
                <div style={{background:T.gray50,padding:"10px 12px",fontSize:"18px",fontWeight:800,color:T.black}}>₦{p.val.toLocaleString()}/L</div>
              )}
            </div>
          ))}
          <div style={{background:T.greenLight,padding:"10px 12px",display:"flex",alignItems:"center",gap:"7px"}}>
            <span>📡</span><span style={{fontSize:"11px",fontWeight:700,color:T.greenDark}}>Live on marketplace</span>
          </div>
        </Card>

        {/* Inventory */}
        <Card>
          <SectionHead title="Inventory Status" sub="Current stock · Apapa"/>
          {[{prod:"PMS",current:61200,cap:85000},{prod:"Total",current:61200,cap:85000}].map(s=>(
            <div key={s.prod} style={{marginBottom:"16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
                <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>{s.prod}</span>
                <span style={{fontSize:"11px",fontWeight:700,color:T.gray400}}>{(s.current/1000).toFixed(1)}k/{(s.cap/1000).toFixed(0)}k MT · <span style={{color:T.green,fontWeight:800}}>{Math.round(s.current/s.cap*100)}%</span></span>
              </div>
              <div style={{height:"7px",background:T.gray100,borderRadius:"4px",overflow:"hidden"}}><div style={{height:"100%",width:`${Math.round(s.current/s.cap*100)}%`,background:T.green,borderRadius:"4px"}}/></div>
            </div>
          ))}
          <div style={{background:T.amberLight,padding:"10px 14px",marginTop:"6px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:"#8A5C00",marginBottom:"2px"}}>⚠ Restock in ~4 days</div>
            <div style={{fontSize:"11px",color:"#8A5C00"}}>Contact NNPC for next PMS allocation.</div>
          </div>
        </Card>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.5fr 1fr",gap:"14px"}}>
        <Card>
          <SectionHead title="Revenue Trend" sub="₦ Millions · 6 months"/>
          <ResponsiveContainer width="100%" height={isMobile?150:170}>
            <AreaChart data={REVENUE_DATA} margin={{top:4,right:0,bottom:0,left:-24}}>
              <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.green} stopOpacity={0.15}/><stop offset="95%" stopColor={T.green} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="2 4" stroke={T.gray100}/>
              <XAxis dataKey="month" tick={{fill:T.gray400,fontSize:10,fontFamily:F,fontWeight:600}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:T.gray400,fontSize:10,fontFamily:F,fontWeight:600}} axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTip/>}/>
              <Area type="monotone" dataKey="revenue" stroke={T.green} strokeWidth={2.5} fill="url(#rg)" name="Revenue" dot={{fill:T.green,r:3,strokeWidth:0}}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionHead title="Orders by Day" sub="This week"/>
          <ResponsiveContainer width="100%" height={isMobile?150:170}>
            <BarChart data={DAILY} barSize={7} margin={{left:-24,bottom:0}}>
              <CartesianGrid strokeDasharray="2 4" stroke={T.gray100} vertical={false}/>
              <XAxis dataKey="day" tick={{fill:T.gray400,fontSize:10,fontFamily:F,fontWeight:600}} axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="pms" fill={T.green} name="PMS" radius={[2,2,0,0]}/>
              <Bar dataKey="ago" fill={T.blue} name="AGO" radius={[2,2,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function DepotInbox({depotId,isMobile,onViewOrder}) {
  // Merge buyer-placed orders (newest first) with static INCOMING
  const [liveOrders,setLiveOrders]=useState([]);
  const {depotOrders,loadDepotOrders}=useVentrylStore();
  useEffect(()=>{if(depotId)loadDepotOrders(depotId);},[depotId]);
  const dbOrders=depotOrders[depotId]||[];
  const ALL_INCOMING=[...liveOrders,..._placedOrdersStore.slice().reverse(),...dbOrders.filter(o=>!liveOrders.find(l=>l.id===o.id)&&!_placedOrdersStore.find(p=>p.id===o.id))];

  // Realtime: new orders for this depot
  useDepotInboxRealtime(depotId,(payload)=>{
    if(payload.eventType==="INSERT"&&payload.new){
      const o=payload.new;
      // Normalize to local shape
      setLiveOrders(prev=>[{
        id:o.id,
        buyer:o.buyer_name||"New Buyer",
        product:o.product||"PMS",
        vol:o.vol_litres||0,
        value:o.total_value||0,
        trucks:o.truck_count||1,
        status:o.status||"pending",
        location:o.delivery_address||"Lagos",
        type:o.delivery_type||"delivery",
        submitted:"Just now",
        slaLeft:"3h 00m",
        depot:"",
      },...prev]);
    }
  });

  const [acted,setActed]=useState(()=>{
    const a={};
    ALL_INCOMING.forEach(o=>{
      const s=_orderStatusStore[o.id];
      if(s==="confirmed")a[o.id]="confirm";
      else if(s==="rejected")a[o.id]="reject";
    });
    return a;
  });
  const [bays,setBays]=useState(()=>({..._orderBayStore}));
  const BAYS=["Bay 1","Bay 2","Bay 3"];

  // Active dispatches — per-truck detail
  const DISPATCHES=[
    {id:"VTL-00841",buyer:"Chukwuma Fuels Ltd",product:"PMS",vol:90000,stage:"in_transit",bay:"Bay 1",loadRef:"LOAD-2026-031",
     trucks:[
       {n:1,driver:"Emeka Nwosu",plate:"LSD-481-KJ",vol:33000,departure:"08:45",eta:"13:30",progress:72,status:"in_transit"},
       {n:2,driver:"Bayo Adeyemi",plate:"LSD-219-AB",vol:33000,departure:"08:50",eta:"13:45",progress:68,status:"in_transit"},
       {n:3,driver:"Chidi Okonkwo",plate:"LSD-774-QR",vol:24000,departure:"09:00",eta:"14:00",progress:60,status:"in_transit"},
     ]},
    {id:"VTL-00839",buyer:"Silvergate Energy",product:"PMS",vol:132000,stage:"loading",bay:"Bay 2",loadRef:"LOAD-2026-029",
     trucks:[
       {n:1,driver:"Seun Obi",plate:"LSD-302-MK",vol:33000,departure:"11:00",eta:"16:30",progress:100,status:"loaded"},
       {n:2,driver:"Kunle Fashola",plate:"LSD-518-GH",vol:33000,departure:"11:00",eta:"16:30",progress:85,status:"loading"},
       {n:3,driver:"Tunde Bello",plate:"LSD-091-XB",vol:33000,departure:"11:00",eta:"16:30",progress:60,status:"loading"},
       {n:4,driver:"Emeka Eze",plate:"LSD-437-NP",vol:33000,departure:"11:00",eta:"16:30",progress:20,status:"loading"},
     ]},
  ];

  const [truckStatus,setTruckStatus]=useState(()=>{
    const s={};
    DISPATCHES.forEach(d=>d.trucks.forEach(t=>{s[`${d.id}-${t.n}`]=t.status;}));
    return s;
  });

  const markTruckDelivered=(orderId,truckN)=>setTruckStatus(s=>({...s,[`${orderId}-${truckN}`]:"delivered"}));
  const allDelivered=(d)=>d.trucks.every(t=>truckStatus[`${d.id}-${t.n}`]==="delivered");

  return (
    <div>
      {/* ── INCOMING ORDERS ── */}
      <div style={{marginBottom:"24px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>Incoming Orders</div>
          {ALL_INCOMING.filter(o=>o.status==="pending"&&!acted[o.id]).length>0&&(
            <div style={{background:T.red,color:T.white,fontSize:"10px",fontWeight:800,padding:"2px 8px"}}>
              {ALL_INCOMING.filter(o=>o.status==="pending"&&!acted[o.id]).length} ACTION REQUIRED
            </div>
          )}
        </div>
        {ALL_INCOMING.filter(o=>o.status==="pending").map(o=>{
          const confirmed=acted[o.id]==="confirm";
          const rejected=acted[o.id]==="reject";
          const assignedBay=bays[o.id];
          return (
            <div key={o.id} style={{border:`2px solid ${confirmed?T.green:rejected?T.red:T.amber}`,background:T.white,marginBottom:"12px"}}>
              {/* NEW ribbon */}
              {!acted[o.id]&&<div style={{background:T.red,color:T.white,fontSize:"9px",fontWeight:800,padding:"3px 10px",letterSpacing:"0.06em",display:"inline-block"}}>NEW</div>}
              <div style={{padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"10px",gap:"10px",flexWrap:isMobile?"wrap":"nowrap"}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:"7px",flexWrap:"wrap",marginBottom:"4px"}}>
                      <button onClick={()=>onViewOrder&&onViewOrder(o.id)} style={{background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:F,fontSize:"13px",fontWeight:800,color:T.black,textDecoration:"underline"}}>{o.id}</button>
                      <span style={{background:T.gray100,color:T.gray600,fontSize:"10px",fontWeight:700,padding:"2px 6px"}}>{o.type}</span>
                    </div>
                    <div style={{fontSize:"13px",fontWeight:700,color:T.black,marginBottom:"2px"}}>{o.buyer}</div>
                    <div style={{fontSize:"11px",color:T.gray400}}>{o.location} · {o.submitted}</div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px 18px",flexShrink:0}}>
                    {[["Product",null],["Volume",`${(o.vol/1000).toFixed(0)}k L`],["Trucks",o.trucks],["Value",`₦${(o.value/1e6).toFixed(1)}M`]].map(([l,v])=>(
                      <div key={l}>
                        <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"1px"}}>{l}</div>
                        {l==="Product"?(
                          o.products?(
                            <div style={{display:"flex",gap:"4px",flexWrap:"wrap",marginTop:"2px"}}>
                              {o.products.map(p=><span key={p} style={{background:T.black,color:T.white,fontSize:"10px",fontWeight:800,padding:"2px 6px"}}>{p}</span>)}
                            </div>
                          ):(
                            <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>{o.product}</div>
                          )
                        ):(
                          <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>{v}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* After confirm — Bay Assignment inline */}
                {confirmed&&!assignedBay&&(
                  <div style={{background:T.greenLight,border:`1px solid ${T.green}`,padding:"10px 12px",marginTop:"8px"}}>
                    <div style={{fontSize:"11px",fontWeight:800,color:T.greenDark,marginBottom:"8px"}}>✓ Confirmed — Assign a loading bay to continue</div>
                    <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                      {BAYS.map(b=>(
                        <button key={b} onClick={()=>{_orderBayStore[o.id]=b;setBays(bv=>({...bv,[o.id]:b}));}} style={{background:T.black,color:T.white,border:"none",padding:"7px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>{b}</button>
                      ))}
                    </div>
                  </div>
                )}
                {confirmed&&assignedBay&&(
                  <div style={{background:T.greenLight,padding:"8px 12px",marginTop:"8px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",flexWrap:"wrap"}}>
                    <span style={{fontSize:"11px",fontWeight:800,color:T.greenDark}}>✓ Confirmed · {assignedBay} Assigned</span>
                    <button onClick={()=>onViewOrder&&onViewOrder(o.id)} style={{background:T.black,color:T.white,border:"none",padding:"6px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"32px"}}>Manage Order →</button>
                  </div>
                )}
                {rejected&&(
                  <div style={{background:T.redLight,padding:"8px 12px",marginTop:"8px"}}>
                    <span style={{fontSize:"11px",fontWeight:800,color:T.red}}>✗ Rejected — Payment returned to buyer</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{borderTop:`1px solid ${T.gray100}`,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"8px",background:T.gray50}}>
                <span style={{fontSize:"11px",fontWeight:800,color:"#8A5C00",background:T.amberLight,padding:"3px 8px"}}>⏱ SLA: {o.slaLeft}</span>
                {!acted[o.id]?(
                  <div style={{display:"flex",gap:"8px"}}>
                    <button onClick={()=>{_orderStatusStore[o.id]="rejected";setActed(a=>({...a,[o.id]:"reject"}));}} style={{background:T.white,color:T.red,border:`1px solid ${T.red}`,padding:"8px 16px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"38px"}}>Reject</button>
                    <button onClick={()=>{_orderStatusStore[o.id]="confirmed";setActed(a=>({...a,[o.id]:"confirm"}));}} style={{background:T.green,color:T.white,border:"none",padding:"8px 16px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"38px"}}>Confirm →</button>
                  </div>
                ):(
                  <button onClick={()=>onViewOrder&&onViewOrder(o.id)} style={{background:"none",border:`1px solid ${T.gray200}`,color:T.black,padding:"7px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>View Details →</button>
                )}
              </div>
            </div>
          );
        })}
        {ALL_INCOMING.filter(o=>o.status==="confirmed").map(o=>(
          <div key={o.id} style={{border:`1px solid ${T.gray100}`,background:T.white,padding:"12px 16px",marginBottom:"8px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"2px"}}>
                <button onClick={()=>onViewOrder&&onViewOrder(o.id)} style={{background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:F,fontSize:"12px",fontWeight:800,color:T.black,textDecoration:"underline"}}>{o.id}</button>
                <Badge status="confirmed"/>
              </div>
              <div style={{fontSize:"11px",color:T.gray400}}>{o.buyer} · {o.products?o.products.join(" + "):o.product} · {(o.vol/1000).toFixed(0)}k L</div>
            </div>
            <button onClick={()=>onViewOrder&&onViewOrder(o.id)} style={{background:T.black,color:T.white,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>Manage →</button>
          </div>
        ))}
      </div>

      {/* ── ACTIVE DISPATCHES ── */}
      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
        <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>Active Dispatches</div>
        <div style={{background:T.blueLight,color:T.blue,fontSize:"10px",fontWeight:800,padding:"2px 8px"}}>{DISPATCHES.length} orders</div>
      </div>
      {DISPATCHES.map(d=>(
        <Card key={d.id} pad={false} style={{marginBottom:"14px"}}>
          {/* Dispatch header */}
          <div style={{padding:"14px 16px",borderBottom:`1px solid ${T.gray100}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"8px"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"3px"}}>
                <button onClick={()=>onViewOrder&&onViewOrder(d.id)} style={{background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:F,fontSize:"13px",fontWeight:800,color:T.black,textDecoration:"underline"}}>{d.id}</button>
                <Badge status={allDelivered(d)?"delivered":d.stage}/>
              </div>
              <div style={{fontSize:"11px",color:T.gray400}}>{d.buyer} · {d.product} · {(d.vol/1000).toFixed(0)}k L · {d.trucks.length} trucks · {d.bay}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:T.black}}>Ref: {d.loadRef}</div>
              <div style={{fontSize:"10px",color:d.stage==="in_transit"?T.blue:T.amber,fontWeight:700,marginTop:"2px"}}>{d.stage==="in_transit"?"En Route":"Loading"}</div>
            </div>
          </div>

          {/* Overall progress */}
          <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.gray100}`,background:T.gray50}}>
            {(() => {
              const delivered=d.trucks.filter(t=>truckStatus[`${d.id}-${t.n}`]==="delivered").length;
              const total=d.trucks.length;
              const pct=Math.round((delivered/total)*100);
              return (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
                    <span style={{fontSize:"11px",fontWeight:700,color:T.black}}>{delivered}/{total} trucks delivered</span>
                    <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>{pct}%</span>
                  </div>
                  <div style={{height:"6px",background:T.gray200,borderRadius:"3px",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:pct===100?T.green:T.blue,borderRadius:"3px",transition:"width 0.4s"}}/>
                  </div>
                  {allDelivered(d)&&(
                    <div style={{marginTop:"8px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"6px"}}>
                      <span style={{fontSize:"11px",fontWeight:800,color:T.greenDark}}>✓ All trucks delivered</span>
                      <button style={{background:T.green,color:T.white,border:"none",padding:"6px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"32px"}}>Mark Order Complete →</button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Per-truck rows */}
          {d.trucks.map((t,i)=>{
            const tKey=`${d.id}-${t.n}`;
            const tStatus=truckStatus[tKey]||t.status;
            const isDelivered=tStatus==="delivered";
            return (
              <div key={t.n} style={{padding:"12px 16px",borderBottom:i<d.trucks.length-1?`1px solid ${T.gray100}`:"none",display:"flex",alignItems:"center",gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
                {/* Truck icon */}
                <div style={{width:"36px",height:"36px",background:isDelivered?T.greenLight:tStatus==="loaded"?T.amberLight:T.blueLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",flexShrink:0}}>
                  🚛
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"2px",flexWrap:"wrap"}}>
                    <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>Truck {t.n}</span>
                    <Badge status={isDelivered?"delivered":tStatus==="loaded"?"confirmed":tStatus}/>
                    <span style={{fontSize:"10px",color:T.gray400}}>{t.plate}</span>
                  </div>
                  <div style={{fontSize:"11px",color:T.gray600,fontWeight:600}}>{t.driver}</div>
                  {d.stage==="in_transit"&&!isDelivered&&(
                    <div style={{marginTop:"6px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:"3px"}}>
                        <span style={{fontSize:"10px",color:T.gray400}}>Departed {t.departure} · ETA {t.eta}</span>
                        <span style={{fontSize:"10px",fontWeight:700,color:T.black}}>{t.progress}%</span>
                      </div>
                      <div style={{height:"4px",background:T.gray100,borderRadius:"2px",overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${t.progress}%`,background:T.blue,borderRadius:"2px"}}/>
                      </div>
                    </div>
                  )}
                  {tStatus==="loaded"&&<div style={{fontSize:"10px",color:"#8A5C00",marginTop:"3px",fontWeight:700}}>Loaded · Ready to depart</div>}
                </div>
                <div style={{flexShrink:0}}>
                  {isDelivered?(
                    <span style={{fontSize:"11px",fontWeight:800,color:T.greenDark}}>✓ Delivered</span>
                  ):d.stage==="in_transit"?(
                    <button onClick={()=>markTruckDelivered(d.id,t.n)} style={{background:T.green,color:T.white,border:"none",padding:"7px 12px",fontSize:"10px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"34px",whiteSpace:"nowrap"}}>Mark Delivered</button>
                  ):tStatus==="loaded"?(
                    <span style={{fontSize:"10px",fontWeight:800,color:"#8A5C00"}}>Ready</span>
                  ):(
                    <span style={{fontSize:"10px",color:T.gray400}}>Loading…</span>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      ))}

      {DISPATCHES.length===0&&(
        <div style={{border:`1px dashed ${T.gray200}`,padding:"32px",textAlign:"center"}}>
          <div style={{fontSize:"13px",fontWeight:700,color:T.gray400}}>No active dispatches</div>
          <div style={{fontSize:"11px",color:T.gray400,marginTop:"4px"}}>Confirmed and dispatched orders will appear here.</div>
        </div>
      )}
    </div>
  );
}

function TruckSched({isMobile}) {
  return (
    <div>
      <SectionHead title="Loading Bay Schedule" sub="Tue 10 Mar 2026 · Apapa Depot"
        right={<div style={{display:"flex",gap:"6px"}}>
          {["← Prev","Next →"].map(b=><button key={b} style={{background:T.white,border:`1px solid ${T.gray200}`,color:T.black,padding:"6px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,borderRadius:"4px",minHeight:"36px"}}>{b}</button>)}
        </div>}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px"}}>
        {["Bay 1","Bay 2"].map(bay=>{
          const bs=SLOTS.filter(s=>s.bay===bay),booked=bs.filter(s=>s.status!=="open").length;
          return (<Card key={bay}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px"}}>
              <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{bay}</div>
              <div style={{fontSize:"11px",fontWeight:700,color:T.gray400}}>{booked}/{bs.length}</div>
            </div>
            <div style={{height:"5px",background:T.gray100,borderRadius:"3px",overflow:"hidden"}}><div style={{height:"100%",width:`${booked/bs.length*100}%`,background:T.green}}/></div>
            <div style={{fontSize:"10px",color:T.gray400,marginTop:"4px"}}>{Math.round(booked/bs.length*100)}% utilised</div>
          </Card>);
        })}
      </div>
      {isMobile?(
        <div>
          {SLOTS.map((s,i)=>(
            <div key={i} style={{border:`1px solid ${T.gray100}`,background:s.status==="open"?`${T.green}08`:T.white,padding:"14px 16px",marginBottom:"8px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                <div>
                  <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{s.time} · {s.bay}</div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{s.order} {s.product!=="—"?`· ${s.product}`:""}{s.trucks?` · ${s.trucks} 🚛`:""}</div>
                </div>
                <Badge status={s.status}/>
              </div>
              {s.status==="open"&&<button style={{background:T.black,color:T.white,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,width:"100%",minHeight:"40px"}}>Assign Order</button>}
              {s.status==="loading"&&<button style={{background:T.green,color:T.white,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,width:"100%",minHeight:"40px"}}>Mark Departed</button>}
            </div>
          ))}
        </div>
      ):(
        <Card pad={false}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${T.gray100}`}}>{["Time","Bay","Order","Product","Trucks","Status","Action"].map(h=><th key={h} style={{padding:"10px 18px",fontFamily:F,fontSize:"10px",fontWeight:700,color:T.gray400,textAlign:"left",textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>{SLOTS.map((s,i)=>(
              <tr key={i} style={{borderBottom:i<SLOTS.length-1?`1px solid ${T.gray100}`:"none",background:s.status==="open"?`${T.green}08`:T.white}}>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"13px",fontWeight:800,color:T.black}}>{s.time}</td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"12px",color:T.gray600}}>{s.bay}</td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"12px",fontWeight:700,color:s.order==="—"?T.gray200:T.black}}>{s.order}</td>
                <td style={{padding:"13px 18px"}}>{s.product!=="—"?<span style={{background:T.gray100,color:T.black,fontSize:"10px",fontWeight:800,padding:"3px 7px"}}>{s.product}</span>:<span style={{color:T.gray200}}>—</span>}</td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"12px",fontWeight:800,color:s.trucks?T.black:T.gray200}}>{s.trucks?`${s.trucks} 🚛`:"—"}</td>
                <td style={{padding:"13px 18px"}}><Badge status={s.status}/></td>
                <td style={{padding:"13px 18px"}}>
                  {s.status==="open"?<button style={{background:T.black,color:T.white,border:"none",padding:"6px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>Assign</button>
                  :s.status==="loading"?<button style={{background:T.green,color:T.white,border:"none",padding:"6px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>Departed</button>
                  :<span style={{fontSize:"11px",color:T.gray400}}>—</span>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function BuyerNetwork({isMobile}) {
  return (
    <div>
      <SectionHead title="Buyer Network" sub={`${BUYERS_DATA.length} active buyers · Ventryl Credit Score`}/>
      {isMobile?(
        BUYERS_DATA.map((b,i)=>(
          <div key={b.name} style={{border:`1px solid ${T.gray100}`,background:T.white,padding:"14px 16px",marginBottom:"8px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
              <div>
                <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{b.name}</div>
                <div style={{fontSize:"11px",color:T.gray400,marginTop:"1px"}}>{b.type} · Last: {b.lastOrder}</div>
              </div>
              <span style={{background:b.tier==="Gold"?T.amberLight:b.tier==="Silver"?T.gray100:"#F3F0FF",color:b.tier==="Gold"?"#8A5C00":b.tier==="Silver"?T.gray600:"#8B5CF6",fontSize:"10px",fontWeight:700,padding:"3px 8px",borderRadius:"3px"}}>{b.tier}</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
              {[["Orders",b.orders],["Volume",b.vol],["Spend",b.spend]].map(([l,v])=>(
                <div key={l}><div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>{l}</div><div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{v}</div></div>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"7px",marginTop:"10px"}}>
              <div style={{flex:1,height:"3px",background:T.gray100,borderRadius:"2px",overflow:"hidden"}}><div style={{height:"100%",width:`${b.score/10}%`,background:b.score>=750?T.green:b.score>=650?T.amber:T.gray400}}/></div>
              <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>{b.score}</span>
            </div>
          </div>
        ))
      ):(
        <Card pad={false}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${T.gray100}`}}>{["Buyer","Type","Orders","Volume","Spend","VCS","Tier","Last"].map(h=><th key={h} style={{padding:"10px 18px",fontFamily:F,fontSize:"10px",fontWeight:700,color:T.gray400,textAlign:"left",textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>{BUYERS_DATA.map((b,i)=>(
              <tr key={b.name} style={{borderBottom:i<BUYERS_DATA.length-1?`1px solid ${T.gray100}`:"none"}}
                onMouseEnter={e=>e.currentTarget.style.background=T.gray50}
                onMouseLeave={e=>e.currentTarget.style.background=T.white}>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"13px",fontWeight:800,color:T.black}}>{b.name}</td>
                <td style={{padding:"13px 18px"}}><span style={{background:T.gray100,color:T.gray600,fontSize:"10px",fontWeight:700,padding:"3px 7px",borderRadius:"3px"}}>{b.type}</span></td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"13px",fontWeight:700,color:T.black}}>{b.orders}</td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"12px",color:T.gray600}}>{b.vol}</td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"13px",fontWeight:800,color:T.black}}>{b.spend}</td>
                <td style={{padding:"13px 18px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
                    <div style={{height:"3px",background:T.gray100,borderRadius:"2px",overflow:"hidden",width:"50px"}}><div style={{height:"100%",width:`${b.score/10}%`,background:b.score>=750?T.green:b.score>=650?T.amber:T.gray400}}/></div>
                    <span style={{fontFamily:F,fontSize:"12px",fontWeight:800,color:T.black}}>{b.score}</span>
                  </div>
                </td>
                <td style={{padding:"13px 18px"}}><span style={{background:b.tier==="Gold"?T.amberLight:b.tier==="Silver"?T.gray100:"#F3F0FF",color:b.tier==="Gold"?"#8A5C00":b.tier==="Silver"?T.gray600:"#8B5CF6",fontSize:"10px",fontWeight:700,padding:"3px 8px",borderRadius:"3px"}}>{b.tier}</span></td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"11px",color:T.gray400}}>{b.lastOrder}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   TEAM SETTINGS
════════════════════════════════════════════ */
function TeamSettings({isMobile}) {
  const ROLES=[
    {id:"admin",     label:"Admin",      desc:"Full platform access — manage team, orders, finances, settings", color:T.black},
    {id:"manager",   label:"Manager",    desc:"Manage orders, inventory, buyers and team members",             color:T.blue},
    {id:"supervisor",label:"Supervisor", desc:"Manage orders and update inventory",                            color:"#9B59B6"},
    {id:"staff",     label:"Staff",      desc:"View and update order status only",                             color:T.green},
    {id:"viewer",    label:"Viewer",     desc:"Read-only access — no edits allowed",                          color:T.gray400},
  ];
  const roleColor=id=>ROLES.find(r=>r.id===id)?.color||T.gray400;
  const roleLabel=id=>ROLES.find(r=>r.id===id)?.label||id;

  const [members,setMembers]=useState([
    {id:1,name:"Adebayo Okafor", role:"manager",    email:"adebayo@nepal-en.com",  status:"active",  joined:"Jan 15, 2026"},
    {id:2,name:"Ngozi Eze",      role:"supervisor", email:"ngozi@nepal-en.com",    status:"active",  joined:"Feb 3, 2026"},
    {id:3,name:"Chidi Nwosu",    role:"staff",      email:"chidi@nepal-en.com",    status:"inactive",joined:"Mar 1, 2026"},
  ]);
  const [invites,setInvites]=useState([
    {id:1,email:"aisha.ibrahim@outlook.com",role:"staff",sent:"Mar 10, 2026"},
  ]);

  // Invite modal state
  const [showInvite,setShowInvite]=useState(false);
  const [invForm,setInvForm]=useState({name:"",email:"",role:"staff"});
  const [invSent,setInvSent]=useState(false);

  // Edit member state
  const [editId,setEditId]=useState(null);
  const [editRole,setEditRole]=useState("");

  // Remove confirmation
  const [removeTarget,setRemoveTarget]=useState(null); // member obj

  const activeCount=members.filter(m=>m.status==="active").length;
  const initials=n=>n.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  const sendInvite=()=>{
    if(!invForm.email.trim()) return;
    setInvites(inv=>[...inv,{id:Date.now(),email:invForm.email.trim(),role:invForm.role,sent:"Just now"}]);
    setInvSent(true);
  };
  const closeInvite=()=>{setShowInvite(false);setInvForm({name:"",email:"",role:"staff"});setInvSent(false);};

  const saveEdit=()=>{
    setMembers(ms=>ms.map(m=>m.id===editId?{...m,role:editRole}:m));
    setEditId(null);
  };

  const toggleStatus=id=>{
    setMembers(ms=>ms.map(m=>m.id===id?{...m,status:m.status==="active"?"inactive":"active"}:m));
  };

  const confirmRemove=()=>{
    setMembers(ms=>ms.filter(m=>m.id!==removeTarget.id));
    setRemoveTarget(null);
  };

  const revokeInvite=id=>setInvites(inv=>inv.filter(i=>i.id!==id));
  const resendInvite=id=>setInvites(inv=>inv.map(i=>i.id===id?{...i,sent:"Just now"}:i));

  return (
    <div>
      {/* ── Invite Modal ── */}
      {showInvite&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{background:T.white,width:"100%",maxWidth:"460px"}}>
            {!invSent?(
              <>
                <div style={{background:T.black,padding:"18px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{fontSize:"14px",fontWeight:800,color:T.white}}>Invite Team Member</div>
                  <button onClick={closeInvite} style={{background:"none",border:"none",color:T.gray400,fontSize:"18px",cursor:"pointer",lineHeight:1,padding:"2px 6px"}}>×</button>
                </div>
                <div style={{padding:"20px"}}>
                  <div style={{marginBottom:"14px"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"5px"}}>Full Name</div>
                    <input value={invForm.name} onChange={e=>setInvForm(f=>({...f,name:e.target.value}))}
                      placeholder="e.g. Fatima Musa"
                      style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",color:T.black,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                  <div style={{marginBottom:"14px"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"5px"}}>Email Address *</div>
                    <input value={invForm.email} onChange={e=>setInvForm(f=>({...f,email:e.target.value}))}
                      placeholder="e.g. fatima@company.com" type="email"
                      style={{width:"100%",border:`1px solid ${invForm.email?T.gray200:T.gray200}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",color:T.black,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                  <div style={{marginBottom:"20px"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"8px"}}>Role & Access Level</div>
                    <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                      {ROLES.map(r=>(
                        <button key={r.id} onClick={()=>setInvForm(f=>({...f,role:r.id}))}
                          style={{display:"flex",alignItems:"center",gap:"12px",padding:"10px 12px",border:`2px solid ${invForm.role===r.id?r.color:T.gray100}`,background:invForm.role===r.id?"#F8F8F8":T.white,cursor:"pointer",textAlign:"left",fontFamily:F,transition:"border-color 0.1s"}}>
                          <div style={{width:"8px",height:"8px",borderRadius:"50%",background:r.color,flexShrink:0}}/>
                          <div style={{flex:1}}>
                            <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{r.label}</div>
                            <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>{r.desc}</div>
                          </div>
                          {invForm.role===r.id&&<span style={{fontSize:"14px",color:r.color}}>✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={sendInvite} disabled={!invForm.email.trim()}
                    style={{width:"100%",background:invForm.email.trim()?T.black:T.gray200,color:invForm.email.trim()?T.white:T.gray400,border:"none",padding:"13px",fontSize:"13px",fontWeight:800,cursor:invForm.email.trim()?"pointer":"not-allowed",fontFamily:F,minHeight:"48px"}}>
                    Send Invite →
                  </button>
                </div>
              </>
            ):(
              <div style={{padding:"36px 28px",textAlign:"center"}}>
                <div style={{width:"56px",height:"56px",background:T.greenLight,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:"24px"}}>✓</div>
                <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"8px"}}>Invite Sent!</div>
                <div style={{fontSize:"12px",color:T.gray400,lineHeight:1.6,marginBottom:"6px"}}>
                  An invite email has been sent to <strong style={{color:T.black}}>{invForm.email}</strong>
                </div>
                <div style={{fontSize:"11px",color:T.gray400,marginBottom:"24px"}}>
                  They'll appear under Pending Invites until they accept.
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  <button onClick={()=>{setInvSent(false);setInvForm({name:"",email:"",role:"staff"});}}
                    style={{flex:1,background:T.black,color:T.white,border:"none",padding:"12px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>
                    Invite Another
                  </button>
                  <button onClick={closeInvite}
                    style={{flex:1,background:T.white,color:T.black,border:`1px solid ${T.gray200}`,padding:"12px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Remove Confirmation ── */}
      {removeTarget&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{background:T.white,width:"100%",maxWidth:"360px",padding:"28px"}}>
            <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"8px"}}>Remove {removeTarget.name}?</div>
            <div style={{fontSize:"12px",color:T.gray600,lineHeight:1.6,marginBottom:"20px"}}>
              They will immediately lose access to this depot. This action cannot be undone.
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={confirmRemove}
                style={{flex:1,background:T.red,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
                Remove
              </button>
              <button onClick={()=>setRemoveTarget(null)}
                style={{flex:1,background:T.white,color:T.black,border:`1px solid ${T.gray200}`,padding:"12px",fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px",flexWrap:"wrap",gap:"10px"}}>
        <div>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>Team & Users</div>
          <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{activeCount} active · {invites.length} pending invite{invites.length!==1?"s":""}</div>
        </div>
        <button onClick={()=>setShowInvite(true)}
          style={{background:T.black,color:T.white,border:"none",padding:"10px 18px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px"}}>
          + Invite User
        </button>
      </div>

      {/* ── Active Members ── */}
      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Members ({members.length})</div>
      {members.map(m=>(
        <div key={m.id} style={{border:`1px solid ${T.gray100}`,background:T.white,marginBottom:"8px",overflow:"hidden",opacity:m.status==="inactive"?0.65:1,transition:"opacity 0.2s"}}>
          <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
            {/* Avatar + info */}
            <div style={{display:"flex",alignItems:"center",gap:"12px",flex:1,minWidth:0}}>
              <div style={{width:"38px",height:"38px",borderRadius:"50%",background:m.status==="active"?roleColor(m.role)+"22":T.gray100,border:`2px solid ${m.status==="active"?roleColor(m.role):T.gray200}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:800,color:m.status==="active"?roleColor(m.role):T.gray400,flexShrink:0}}>
                {initials(m.name)}
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:"13px",fontWeight:800,color:T.black,display:"flex",alignItems:"center",gap:"7px",flexWrap:"wrap"}}>
                  {m.name}
                  {m.status==="inactive"&&<span style={{fontSize:"9px",fontWeight:700,color:T.gray400,background:T.gray100,padding:"1px 6px"}}>INACTIVE</span>}
                </div>
                <div style={{fontSize:"11px",color:T.gray400,marginTop:"1px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.email}</div>
                <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>Joined {m.joined}</div>
              </div>
            </div>
            {/* Role badge + actions */}
            <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0,flexWrap:"wrap"}}>
              <span style={{fontSize:"10px",fontWeight:800,color:roleColor(m.role),background:roleColor(m.role)+"18",padding:"3px 9px",whiteSpace:"nowrap"}}>
                {roleLabel(m.role)}
              </span>
              <button onClick={()=>{setEditId(m.id);setEditRole(m.role);}}
                style={{background:"none",border:`1px solid ${T.gray200}`,color:T.gray600,padding:"5px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"32px"}}>
                Edit
              </button>
              <button onClick={()=>toggleStatus(m.id)}
                style={{background:"none",border:`1px solid ${m.status==="active"?T.gray200:T.green}`,color:m.status==="active"?T.gray600:T.green,padding:"5px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"32px"}}>
                {m.status==="active"?"Deactivate":"Activate"}
              </button>
              <button onClick={()=>setRemoveTarget(m)}
                style={{background:"none",border:`1px solid ${T.red}`,color:T.red,padding:"5px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"32px"}}>
                Remove
              </button>
            </div>
          </div>

          {/* Inline edit row */}
          {editId===m.id&&(
            <div style={{borderTop:`1px solid ${T.gray100}`,background:T.gray50,padding:"14px 16px"}}>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"10px"}}>Change Role</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"12px"}}>
                {ROLES.map(r=>(
                  <button key={r.id} onClick={()=>setEditRole(r.id)}
                    style={{padding:"6px 12px",border:`2px solid ${editRole===r.id?r.color:T.gray200}`,background:editRole===r.id?r.color+"18":T.white,color:editRole===r.id?r.color:T.gray600,fontFamily:F,fontSize:"11px",fontWeight:editRole===r.id?800:600,cursor:"pointer",transition:"all 0.1s"}}>
                    {r.label}
                  </button>
                ))}
              </div>
              {editRole&&<div style={{fontSize:"10px",color:T.gray400,marginBottom:"12px"}}>{ROLES.find(r=>r.id===editRole)?.desc}</div>}
              <div style={{display:"flex",gap:"8px"}}>
                <button onClick={saveEdit}
                  style={{background:T.black,color:T.white,border:"none",padding:"8px 18px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>
                  Save Changes ✓
                </button>
                <button onClick={()=>setEditId(null)}
                  style={{background:T.white,color:T.gray400,border:`1px solid ${T.gray200}`,padding:"8px 14px",fontSize:"12px",fontWeight:600,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ── Pending Invites ── */}
      {invites.length>0&&(
        <div style={{marginTop:"20px"}}>
          <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Pending Invites ({invites.length})</div>
          {invites.map(inv=>(
            <div key={inv.id} style={{border:`1px dashed ${T.gray200}`,background:T.white,padding:"12px 16px",marginBottom:"8px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                <div style={{width:"38px",height:"38px",borderRadius:"50%",background:T.amberLight,border:`2px dashed ${T.amber}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",flexShrink:0}}>
                  ✉
                </div>
                <div>
                  <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{inv.email}</div>
                  <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>
                    <span style={{color:"#8A5C00",fontWeight:700,marginRight:"8px"}}>⏳ Pending</span>
                    Invited as <strong>{roleLabel(inv.role)}</strong> · Sent {inv.sent}
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:"6px",flexShrink:0}}>
                <button onClick={()=>resendInvite(inv.id)}
                  style={{background:"none",border:`1px solid ${T.gray200}`,color:T.black,padding:"5px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"32px"}}>
                  Resend
                </button>
                <button onClick={()=>revokeInvite(inv.id)}
                  style={{background:"none",border:`1px solid ${T.red}`,color:T.red,padding:"5px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"32px"}}>
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Roles reference ── */}
      <div style={{marginTop:"24px",border:`1px solid ${T.gray100}`,background:T.gray50,padding:"16px"}}>
        <div style={{fontSize:"11px",fontWeight:800,color:T.black,marginBottom:"10px"}}>Role Permissions</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,1fr)",gap:"8px"}}>
          {ROLES.map(r=>(
            <div key={r.id} style={{display:"flex",alignItems:"flex-start",gap:"8px"}}>
              <div style={{width:"8px",height:"8px",borderRadius:"50%",background:r.color,marginTop:"4px",flexShrink:0}}/>
              <div>
                <div style={{fontSize:"11px",fontWeight:800,color:T.black}}>{r.label}</div>
                <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   SETTINGS MODULE
════════════════════════════════════════════ */
function Toggle({on,onChange}) {
  return (
    <div onClick={()=>onChange(!on)} style={{width:"38px",height:"22px",background:on?T.green:T.gray200,borderRadius:"11px",cursor:"pointer",position:"relative",flexShrink:0,transition:"background 0.2s"}}>
      <div style={{width:"16px",height:"16px",background:T.white,borderRadius:"50%",position:"absolute",top:"3px",left:on?"19px":"3px",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.18)"}}/>
    </div>
  );
}

function FieldRow({label,value,onChange,editable=true,verified=false,type="text",hint}) {
  // Controlled if onChange provided, otherwise uncontrolled with internal state
  const [localVal,setLocalVal]=useState(value||"");
  const isControlled=typeof onChange==="function";
  const displayVal=isControlled?value:localVal;
  const handleChange=e=>{
    if(isControlled) onChange(e);
    else setLocalVal(e.target.value);
  };
  return (
    <div style={{marginBottom:"16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"6px"}}>
        <span style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</span>
        {verified&&<span style={{background:T.greenLight,color:T.greenDark,fontSize:"9px",fontWeight:800,padding:"1px 5px"}}>VERIFIED</span>}
      </div>
      {editable?(
        <input type={type} value={displayVal} onChange={handleChange}
          style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 14px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}
          onFocus={e=>e.target.style.borderColor=T.black}
          onBlur={e=>e.target.style.borderColor=T.gray200}/>
      ):(
        <div style={{border:`1px solid ${T.gray100}`,padding:"10px 14px",fontSize:"13px",fontWeight:700,color:T.gray600,background:T.gray50}}>{displayVal||"—"}</div>
      )}
      {hint&&<div style={{fontSize:"10px",color:T.gray400,marginTop:"4px",fontWeight:600}}>{hint}</div>}
    </div>
  );
}

function SettingsBlock({title,children}) {
  return (
    <div style={{marginBottom:"24px"}}>
      <div style={{fontSize:"10px",fontWeight:800,color:T.black,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"12px",paddingBottom:"8px",borderBottom:`2px solid ${T.black}`}}>{title}</div>
      {children}
    </div>
  );
}

function NotifRow({label,sub,on,onChange}) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${T.gray100}`}}>
      <div>
        <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>{label}</div>
        {sub&&<div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{sub}</div>}
      </div>
      <Toggle on={on} onChange={onChange}/>
    </div>
  );
}

function SettingsModule({portalType,isMobile,depot,onUpdateDepot}) {
  const [tab,setTab]=useState("profile");
  const [saved,setSaved]=useState(false);
  const [notif,setNotif]=useState({orderUpdates:true,priceAlerts:true,slaWarnings:true,deliveryConfirm:true,emailCh:true,smsCh:true,pushCh:false,weeklyReport:portalType==="depot"});
  const [twoFA,setTwoFA]=useState(true);
  const [showPwForm,setShowPwForm]=useState(false);
  const [bays,setBays]=useState([
    {id:"Bay 1",capacity:33000,products:["PMS"],hours:"07:00–19:00",active:true},
    {id:"Bay 2",capacity:33000,products:["PMS","AGO"],hours:"07:00–19:00",active:true},
  ]);


  const {user:authUser,profile:authProfile,setProfile}=useAuthStore();
  const isBuyer=portalType==="buyer";

  // Profile form state — seeded from real DB profile
  const [profileForm,setProfileForm]=useState({
    fullName:"",companyName:"",phone:"",state:"",lga:"",cacNumber:"",
    contactPerson:"",jobTitle:"",email:"",address:"",
  });
  const [profileSaving,setProfileSaving]=useState(false);
  const [profileLoaded,setProfileLoaded]=useState(false);
  useEffect(()=>{
    if(!authProfile||profileLoaded) return;
    setProfileForm({
      fullName:authProfile.full_name||"",
      companyName:authProfile.company_name||"",
      phone:authProfile.phone||"",
      state:authProfile.state||"",
      lga:authProfile.lga||"",
      cacNumber:authProfile.cac_number||"",
      contactPerson:authProfile.full_name||"",
      jobTitle:authProfile.job_title||"",
      email:authUser?.email||"",
      address:authProfile.address||"",
    });
    setProfileLoaded(true);
  },[authProfile,profileLoaded]);

  const handleSaveProfile=async()=>{
    if(!authUser) return;
    setProfileSaving(true);
    try{
      const updated=await profilesApi.update(authUser.id,{
        full_name:profileForm.fullName,
        company_name:profileForm.companyName,
        phone:profileForm.phone,
        state:profileForm.state,
        lga:profileForm.lga,
        cac_number:profileForm.cacNumber,
      });
      setProfile({...authProfile,...updated});
      setSaved(true);
      setTimeout(()=>setSaved(false),2200);
    }catch(e){
      console.error("Failed to save profile",e);
    }finally{
      setProfileSaving(false);
    }
  };
  const pf=(k)=>profileForm[k];
  const sp=(k)=>e=>setProfileForm(f=>({...f,[k]:e.target.value}));

  // Notification prefs: seed from DB profile, fall back to defaults
  const [notifLoaded,setNotifLoaded]=useState(false);
  const [notifSaving,setNotifSaving]=useState(false);
  useEffect(()=>{
    if(!authUser||notifLoaded) return;
    notifApi.getPrefs(authUser.id).then(prefs=>{
      if(prefs) setNotif(p=>({...p,...prefs}));
      setNotifLoaded(true);
    }).catch(()=>setNotifLoaded(true));
  },[authUser,notifLoaded]);

  const handleSaveNotifPrefs=async()=>{
    if(!authUser) return handleSave();
    setNotifSaving(true);
    try{
      await notifApi.savePrefs(authUser.id,notif);
      setProfile({...authProfile,notif_prefs:notif});
      setSaved(true);
      setTimeout(()=>setSaved(false),2200);
    }catch(e){
      console.error("Failed to save notif prefs",e);
    }finally{
      setNotifSaving(false);
    }
  };

  // Settings realtime: auto-update profile when kyc_status or notif_prefs change remotely
  useProfileRealtime(authUser?.id,(payload)=>{
    if(payload?.new) setProfile(p=>({...p,...payload.new}));
  });

  // KYC state (buyer settings)
  const [kycFiles,setKycFiles]=useState({});
  const [kycUploaded,setKycUploaded]=useState({});
  const [kycUploading,setKycUploading]=useState({});
  const [kycUploadErr,setKycUploadErr]=useState({});
  const [kycSubmitting,setKycSubmitting]=useState(false);
  const [kycSubmitted,setKycSubmitted]=useState(authProfile?.kyc_status==="submitted"||authProfile?.kyc_status==="verified");
  const [kycSubmitErr,setKycSubmitErr]=useState("");

  const KYC_DOCS=[
    {key:"nin",            label:"NIN / National ID",          required:true,  hint:"National Identity Number slip or NIN card"},
    {key:"cac_cert",       label:"CAC Certificate",            required:true,  hint:"Certificate of Incorporation — required for company accounts"},
    {key:"proof_of_address",label:"Proof of Address",          required:true,  hint:"Utility bill or bank statement — not older than 3 months"},
  ];
  const kycReqDocs=KYC_DOCS.filter(d=>d.required);
  const kycDoneCount=kycReqDocs.filter(d=>kycUploaded[d.key]).length;
  const kycAllDone=kycDoneCount===kycReqDocs.length;

  const handleKycUpload=async(doc,file)=>{
    if(!file||!authUser) return;
    setKycUploading(u=>({...u,[doc.key]:true}));
    setKycUploadErr(e=>({...e,[doc.key]:""}));
    try{
      await kycApi.uploadDocument(authUser.id,doc.key,file);
      setKycUploaded(u=>({...u,[doc.key]:file.name}));
      setKycFiles(f=>({...f,[doc.key]:file}));
    }catch(e){
      setKycUploadErr(err=>({...err,[doc.key]:e.message||"Upload failed"}));
    }finally{
      setKycUploading(u=>({...u,[doc.key]:false}));
    }
  };

  const handleKycSubmit=async()=>{
    if(!kycAllDone||!authUser) return;
    setKycSubmitting(true);
    setKycSubmitErr("");
    try{
      await kycApi.submit(authUser.id);
      setKycSubmitted(true);
      setProfile({...authProfile,kyc_status:"submitted"});
    }catch(e){
      setKycSubmitErr(e.message||"Submission failed. Try again.");
    }finally{
      setKycSubmitting(false);
    }
  };

  const TABS=isBuyer?[
    {id:"profile",label:"Company Profile",icon:"M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"},
    {id:"verification",label:"Verification",icon:"M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",alert:authProfile&&authProfile.kyc_status==="pending"},
    {id:"notifications",label:"Notifications",icon:"M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"},
    {id:"wallet",label:"Wallet & Payment",icon:"M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"},
    {id:"security",label:"Security",icon:"M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"},
  ]:[
    {id:"profile",label:"Depot Profile",icon:"M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"},
    {id:"notifications",label:"Notifications",icon:"M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"},
    {id:"bays",label:"Loading Bays",icon:"M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"},
    {id:"products",label:"Products",icon:"M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"},
    {id:"team",label:"Team & Users",icon:"M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"},
    {id:"security",label:"Security",icon:"M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"},
  ];

  const handleSave=()=>{setSaved(true);setTimeout(()=>setSaved(false),2200);};
  const SaveBtn=({label="Save Changes"})=>(
    <button onClick={handleSave} style={{background:saved?T.green:T.black,color:T.white,border:"none",padding:"12px 28px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px",transition:"background 0.2s",marginTop:"6px"}}>
      {saved?"✓ Saved":label}
    </button>
  );

  const content={
    profile:(
      <div>
        {isBuyer?(
          <>
            <SettingsBlock title="Company Information">
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
                <FieldRow label="Company Name" value={pf("companyName")} onChange={sp("companyName")} verified={authProfile?.kyc_status==="verified"} editable={authProfile?.kyc_status!=="verified"}/>
                <FieldRow label="RC / CAC Number" value={pf("cacNumber")} onChange={sp("cacNumber")} verified={authProfile?.kyc_status==="verified"} editable={authProfile?.kyc_status!=="verified"}/>
                <FieldRow label="State" value={pf("state")} onChange={sp("state")}/>
                <FieldRow label="LGA" value={pf("lga")} onChange={sp("lga")}/>
              </div>
              {authProfile?.kyc_status==="verified"&&<div style={{fontSize:"10px",color:T.gray400,fontWeight:600,marginTop:"-8px",marginBottom:"4px"}}>Verified fields are locked. Contact support to update.</div>}
            </SettingsBlock>
            <SettingsBlock title="Contact Details">
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
                <FieldRow label="Full Name" value={pf("fullName")} onChange={sp("fullName")}/>
                <FieldRow label="Phone Number" value={pf("phone")} onChange={sp("phone")} type="tel"/>
                <FieldRow label="Email Address" value={pf("email")} editable={false}/>
              </div>
              <FieldRow label="Business Address" value={pf("address")} onChange={sp("address")}/>
            </SettingsBlock>
          </>
        ):(
          <>
            <SettingsBlock title="Depot Information">
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
                <FieldRow label="Depot Name" value={depot?.name||"Nepal Energies"} verified editable={false}/>
                <FieldRow label="NMDPRA License" value={depot?.license||"DL-2019-APR-0042"} verified editable={false}/>
                <FieldRow label="Total Capacity (L)" value={depot?.capacity?(depot.capacity).toLocaleString():"85,000"} editable={false}/>
                <FieldRow label="License Expiry" value="Apr 2027" editable={false}/>
              </div>
              <div style={{fontSize:"10px",color:T.gray400,fontWeight:600,marginTop:"-8px",marginBottom:"4px"}}>Verified fields are locked. Contact your account manager to update.</div>
            </SettingsBlock>
            <SettingsBlock title="Location & Contact">
              <FieldRow label="Address" value={depot?.location||""}/>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
                <FieldRow label="Operations Contact" value={depot?._raw?.contact_name||""}/>
                <FieldRow label="Phone" value={depot?._raw?.contact_phone||""} type="tel"/>
                <FieldRow label="Email" value={depot?._raw?.contact_email||""} type="email"/>
              </div>
            </SettingsBlock>
            <SettingsBlock title="Active Products">
              <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"10px"}}>
                {(depot?.products||[]).length===0?(
                  <span style={{fontSize:"12px",color:T.gray400,fontWeight:600}}>No products configured. Go to Products tab to add.</span>
                ):(depot?.products||[]).map(p=>(
                  <span key={p.id} style={{padding:"6px 14px",background:T.black,color:T.white,fontSize:"12px",fontWeight:800,display:"inline-flex",alignItems:"center",gap:"6px"}}>
                    {p.name}
                    <span style={{fontSize:"10px",color:T.gray400}}>₦{p.pricePerLitre?.toLocaleString()}/L</span>
                  </span>
                ))}
              </div>
              <button onClick={()=>setTab("products")} style={{background:"none",border:`1px solid ${T.gray200}`,padding:"7px 14px",fontSize:"11px",fontWeight:700,color:T.gray600,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>Manage Products →</button>
            </SettingsBlock>
          </>
        )}
        {isBuyer?(
          <button onClick={handleSaveProfile} disabled={profileSaving} style={{background:saved?T.green:T.black,color:T.white,border:"none",padding:"12px 28px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px",transition:"background 0.2s",marginTop:"6px",opacity:profileSaving?0.6:1}}>
            {profileSaving?"Saving…":saved?"✓ Saved":"Save Changes"}
          </button>
        ):(
          <SaveBtn/>
        )}
      </div>
    ),

    notifications:(
      <div>
        <SettingsBlock title="Order Alerts">
          <NotifRow label="Order status updates" sub="Confirmation, dispatch, and delivery changes" on={notif.orderUpdates} onChange={v=>setNotif(n=>({...n,orderUpdates:v}))}/>
          <NotifRow label="SLA warnings" sub="Alert when approaching response deadline" on={notif.slaWarnings} onChange={v=>setNotif(n=>({...n,slaWarnings:v}))}/>
          <NotifRow label="Delivery confirmation" sub={isBuyer?"Notify when depot confirms dispatch":"Notify when buyer confirms receipt"} on={notif.deliveryConfirm} onChange={v=>setNotif(n=>({...n,deliveryConfirm:v}))}/>
          {isBuyer?(
            <NotifRow label="Price alerts" sub="Notify when depot prices change significantly" on={notif.priceAlerts} onChange={v=>setNotif(n=>({...n,priceAlerts:v}))}/>
          ):(
            <NotifRow label="Weekly summary report" sub="Volume, revenue, and utilisation digest" on={notif.weeklyReport} onChange={v=>setNotif(n=>({...n,weeklyReport:v}))}/>
          )}
        </SettingsBlock>
        <SettingsBlock title="Channels">
          <NotifRow label="Email" sub={isBuyer?"emeka@chukwumafuels.com":"ops@nepal-energies.com"} on={notif.emailCh} onChange={v=>setNotif(n=>({...n,emailCh:v}))}/>
          <NotifRow label="SMS" sub={authProfile?.phone||isBuyer?"+234 803 456 7890":"+234 802 345 6789"} on={notif.smsCh} onChange={v=>setNotif(n=>({...n,smsCh:v}))}/>
          <NotifRow label="Push notifications" sub="Browser and mobile push" on={notif.pushCh} onChange={v=>setNotif(n=>({...n,pushCh:v}))}/>
        </SettingsBlock>
        <button onClick={handleSaveNotifPrefs} disabled={notifSaving}
          style={{background:saved?T.green:T.black,color:T.white,border:"none",padding:"12px 28px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px",transition:"background 0.2s",marginTop:"6px",opacity:notifSaving?0.6:1}}>
          {notifSaving?"Saving…":saved?"✓ Saved":"Save Preferences"}
        </button>
      </div>
    ),

    wallet:(
      <div>
        <SettingsBlock title="Payout Wallet">
          <div style={{background:T.black,padding:"20px 22px",marginBottom:"14px"}}>
            <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"4px"}}>Available Balance</div>
            <div style={{fontSize:"30px",fontWeight:800,color:T.green,letterSpacing:"-0.02em"}}>₦25,830,000</div>
            <div style={{fontSize:"11px",color:T.gray400,marginTop:"4px"}}>Settlement Account · Auto-managed</div>
          </div>
          <div style={{border:`1px solid ${T.gray100}`,marginBottom:"12px"}}>
            {[["Account Name","Chukwuma Fuels Ltd"],["Account Number","0112 3456 78"],["Bank","Settlement Bank"],["Account Type","Settlement Account"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${T.gray100}`,fontSize:"12px"}}>
                <span style={{color:T.gray400,fontWeight:600}}>{k}</span>
                <span style={{color:T.black,fontWeight:700}}>{v}</span>
              </div>
            ))}
          </div>
          <button style={{background:T.green,color:T.black,border:"none",padding:"10px 20px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px"}}>+ Fund Wallet</button>
        </SettingsBlock>
        <SettingsBlock title="Withdrawal Account">
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
            <FieldRow label="Bank Name" value="GTBank"/>
            <FieldRow label="Account Number" value="0123456789"/>
          </div>
          <FieldRow label="Account Name" value="Chukwuma Fuels Ltd" editable={false}/>
          <div style={{background:T.amberLight,padding:"10px 14px",marginBottom:"6px",fontSize:"11px",color:"#8A5C00",fontWeight:600}}>
            Changes to your bank account require 48h verification.
          </div>
        </SettingsBlock>
        <SettingsBlock title="Spending Limits">
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
            <FieldRow label="Max order value (₦)" value="100,000,000" hint="Per single order"/>
            <FieldRow label="Daily transaction limit (₦)" value="250,000,000"/>
          </div>
        </SettingsBlock>
        <SaveBtn/>
      </div>
    ),

    bays:(
      <div>
        <SettingsBlock title="Bay Configuration">
          {bays.map((bay,i)=>(
            <div key={bay.id} style={{border:`1px solid ${T.gray100}`,background:T.white,padding:"16px",marginBottom:"12px",opacity:bay.active?1:0.6}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
                <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>{bay.id}</div>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  <span style={{fontSize:"11px",color:T.gray400,fontWeight:600}}>{bay.active?"Active":"Inactive"}</span>
                  <Toggle on={bay.active} onChange={v=>setBays(p=>p.map((b,j)=>j===i?{...b,active:v}:b))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
                <div style={{marginBottom:"12px"}}>
                  <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Capacity per Slot</div>
                  <div style={{border:`1px solid ${T.gray100}`,padding:"10px 14px",fontSize:"13px",fontWeight:700,color:T.gray600,background:T.gray50}}>{bay.capacity.toLocaleString()} L</div>
                </div>
                <div style={{marginBottom:"12px"}}>
                  <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Operating Hours</div>
                  <input value={bay.hours} onChange={e=>setBays(p=>p.map((b,j)=>j===i?{...b,hours:e.target.value}:b))}
                    style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 14px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}/>
                </div>
              </div>
              <div>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Products</div>
                <div style={{display:"flex",gap:"7px",flexWrap:"wrap"}}>
                  {["PMS","AGO","DPK"].map(p=>{
                    const active=bay.products.includes(p);
                    return (
                      <button key={p} onClick={()=>setBays(prev=>prev.map((b,j)=>j===i?{...b,products:active?b.products.filter(x=>x!==p):[...b.products,p]}:b))}
                        style={{padding:"7px 16px",border:`2px solid ${active?T.black:T.gray200}`,background:active?T.black:T.white,color:active?T.white:T.gray400,fontFamily:F,fontSize:"12px",fontWeight:800,cursor:"pointer"}}>
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </SettingsBlock>
        <SaveBtn label="Save Bay Config"/>
      </div>
    ),

    products:(()=>{
      const ALL_PRODUCTS=[
        {id:"pms",  name:"PMS",  fullName:"Premium Motor Spirit",        unit:"L",  defaultPrice:795,  defaultThreshold:10000},
        {id:"ago",  name:"AGO",  fullName:"Automotive Gas Oil",          unit:"L",  defaultPrice:1185, defaultThreshold:8000},
        {id:"dpk",  name:"DPK",  fullName:"Dual Purpose Kerosene",       unit:"L",  defaultPrice:1338, defaultThreshold:5000},
        {id:"lpg",  name:"LPG",  fullName:"Liquefied Petroleum Gas",     unit:"kg", defaultPrice:1048, defaultThreshold:3000},
        {id:"atk",  name:"ATK",  fullName:"Aviation Turbine Kerosene",   unit:"L",  defaultPrice:1885, defaultThreshold:2500},
        {id:"lpfo", name:"LPFO", fullName:"Low Pour Fuel Oil",           unit:"L",  defaultPrice:855,  defaultThreshold:2000},
        {id:"hpfo", name:"HPFO", fullName:"High Pour Fuel Oil",          unit:"L",  defaultPrice:790,  defaultThreshold:2000},
      ];
      const activeIds=new Set((depot?.products||[]).map(p=>p.id));
      const activeProducts=depot?.products||[];

      const toggleProduct=(pid)=>{
        if(!depot||!onUpdateDepot)return;
        if(activeIds.has(pid)){
          onUpdateDepot(depot.id,{products:activeProducts.filter(p=>p.id!==pid)});
        } else {
          const meta=ALL_PRODUCTS.find(p=>p.id===pid);
          if(!meta)return;
          onUpdateDepot(depot.id,{products:[...activeProducts,{id:meta.id,name:meta.name,pricePerLitre:meta.defaultPrice,stock:0,threshold:meta.defaultThreshold}]});
        }
      };

      const updateProductField=(pid,field,val)=>{
        if(!depot||!onUpdateDepot)return;
        onUpdateDepot(depot.id,{products:activeProducts.map(p=>p.id===pid?{...p,[field]:Number(val)||val}:p)});
      };

      return (
        <div>
          <SettingsBlock title="Available Products">
            <div style={{fontSize:"11px",color:T.gray400,fontWeight:600,marginBottom:"14px"}}>Toggle products on or off. Active products appear on your depot dashboard, inventory, and marketplace listing.</div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"10px",marginBottom:"6px"}}>
              {ALL_PRODUCTS.map(meta=>{
                const on=activeIds.has(meta.id);
                return (
                  <div key={meta.id} onClick={()=>toggleProduct(meta.id)} style={{border:`2px solid ${on?T.black:T.gray100}`,background:on?T.black:T.white,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"all 0.15s"}}>
                    <div>
                      <div style={{fontSize:"13px",fontWeight:800,color:on?T.white:T.black}}>{meta.name}</div>
                      <div style={{fontSize:"10px",color:on?T.gray400:"#999",marginTop:"2px"}}>{meta.fullName}</div>
                    </div>
                    <div style={{width:"20px",height:"20px",borderRadius:"50%",border:`2px solid ${on?T.white:T.gray300}`,background:on?T.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {on&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.black} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  </div>
                );
              })}
            </div>
          </SettingsBlock>

          {activeProducts.length>0&&(
            <SettingsBlock title="Product Configuration">
              <div style={{fontSize:"11px",color:T.gray400,fontWeight:600,marginBottom:"14px"}}>Set pricing and low-stock thresholds for each active product. Changes are reflected immediately on your dashboard.</div>
              {activeProducts.map(p=>(
                <div key={p.id} style={{border:`1px solid ${T.gray100}`,padding:"16px",marginBottom:"10px",background:T.white}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                      <div style={{background:T.black,color:T.white,padding:"4px 10px",fontSize:"11px",fontWeight:800}}>{p.name}</div>
                      <div style={{fontSize:"11px",color:T.gray400,fontWeight:600}}>{ALL_PRODUCTS.find(m=>m.id===p.id)?.fullName}</div>
                    </div>
                    <button onClick={()=>toggleProduct(p.id)} style={{background:"none",border:`1px solid ${T.red}`,color:T.red,padding:"5px 10px",fontSize:"10px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"30px"}}>Remove</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:"12px"}}>
                    <div>
                      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Price per Litre (₦)</div>
                      <input type="number" value={p.pricePerLitre} onChange={e=>updateProductField(p.id,"pricePerLitre",e.target.value)}
                        style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"13px",fontWeight:700,color:T.black,background:T.white,outline:"none"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Current Stock (L)</div>
                      <input type="number" value={p.stock} onChange={e=>updateProductField(p.id,"stock",e.target.value)}
                        style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"13px",fontWeight:700,color:T.black,background:T.white,outline:"none"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Low-Stock Alert (L)</div>
                      <input type="number" value={p.threshold} onChange={e=>updateProductField(p.id,"threshold",e.target.value)}
                        style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"13px",fontWeight:700,color:T.black,background:T.white,outline:"none"}}/>
                    </div>
                  </div>
                  {p.stock<p.threshold&&p.stock>0&&(
                    <div style={{marginTop:"10px",background:T.amberLight,padding:"8px 12px",fontSize:"11px",color:"#8A5C00",fontWeight:600}}>
                      ⚠ Stock below threshold — reorder soon
                    </div>
                  )}
                  {p.stock===0&&(
                    <div style={{marginTop:"10px",background:T.redLight,padding:"8px 12px",fontSize:"11px",color:T.red,fontWeight:600}}>
                      ✕ Out of stock
                    </div>
                  )}
                </div>
              ))}
            </SettingsBlock>
          )}

          {activeProducts.length===0&&(
            <div style={{textAlign:"center",padding:"32px 20px",border:`1px dashed ${T.gray200}`,marginTop:"4px"}}>
              <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"6px"}}>No products added yet</div>
              <div style={{fontSize:"12px",color:T.gray400}}>Toggle products above to add them to your depot.</div>
            </div>
          )}
        </div>
      );
    })(),

    team:(<TeamSettings isMobile={isMobile}/>),

    security:(
      <div>
        <SettingsBlock title="Two-Factor Authentication">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",borderBottom:`1px solid ${T.gray100}`}}>
            <div>
              <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>2FA via SMS</div>
              <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{isBuyer?"+234 803 456 7890":"+234 802 345 6789"} · Required on every login</div>
            </div>
            <Toggle on={twoFA} onChange={setTwoFA}/>
          </div>
          {!twoFA&&(
            <div style={{background:T.redLight,padding:"10px 14px",marginTop:"10px",fontSize:"11px",color:T.red,fontWeight:600}}>
              Disabling 2FA reduces account security. Your wallet requires 2FA for all transactions.
            </div>
          )}
        </SettingsBlock>
        <SettingsBlock title="Password">
          {showPwForm?(
            <div>
              {[["Current Password","password"],["New Password","password"],["Confirm New Password","password"]].map(([l,t])=>(
                <FieldRow key={l} label={l} value="" type={t}/>
              ))}
              <div style={{display:"flex",gap:"8px"}}>
                <button onClick={()=>{handleSave();setTimeout(()=>setShowPwForm(false),1400);}} style={{background:saved?T.green:T.black,color:T.white,border:"none",padding:"11px 20px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"42px"}}>{saved?"✓ Updated":"Update Password"}</button>
                <button onClick={()=>setShowPwForm(false)} style={{background:T.white,color:T.gray400,border:`1px solid ${T.gray200}`,padding:"11px 20px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"42px"}}>Cancel</button>
              </div>
            </div>
          ):(
            <button onClick={()=>setShowPwForm(true)} style={{background:T.white,color:T.black,border:`1px solid ${T.gray200}`,padding:"11px 18px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"42px"}}>Change Password →</button>
          )}
        </SettingsBlock>
        <SettingsBlock title="Active Sessions">
          {[{device:"MacBook Pro · Chrome",location:"Lagos, Nigeria",time:"Current session",current:true},{device:"iPhone 14 · Safari",location:"Lagos, Nigeria",time:"2h ago",current:false}].map(s=>(
            <div key={s.device} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${T.gray100}`,gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
              <div>
                <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>{s.device}</div>
                <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{s.location} · {s.time}</div>
              </div>
              {s.current?(
                <span style={{background:T.greenLight,color:T.greenDark,fontSize:"10px",fontWeight:800,padding:"3px 8px",flexShrink:0}}>ACTIVE NOW</span>
              ):(
                <button style={{background:T.white,color:T.red,border:`1px solid ${T.red}`,padding:"5px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,flexShrink:0,minHeight:"32px"}}>Revoke</button>
              )}
            </div>
          ))}
        </SettingsBlock>
        <SettingsBlock title="API Access">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px",gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
            <div>
              <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>API Key</div>
              <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>For ERP and system integrations</div>
            </div>
            <button style={{background:T.black,color:T.white,border:"none",padding:"8px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,flexShrink:0,minHeight:"36px"}}>Regenerate Key</button>
          </div>
          <div style={{background:T.gray50,border:`1px solid ${T.gray100}`,padding:"11px 14px",fontFamily:"monospace",fontSize:"12px",color:T.gray400,letterSpacing:"0.04em",wordBreak:"break-all"}}>
            vtl_live_••••••••••••••••••••••••••••••••••••
          </div>
          <div style={{fontSize:"10px",color:T.gray400,marginTop:"6px",fontWeight:600}}>Keep your API key secret. Do not share it publicly.</div>
        </SettingsBlock>
      </div>
    ),
    verification:(()=>{
      const status=authProfile?.kyc_status;
      if(status==="verified") return (
        <div>
          <div style={{background:T.greenLight,border:`1px solid ${T.green}`,padding:"18px 20px",display:"flex",alignItems:"center",gap:"14px",marginBottom:"24px"}}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            <div>
              <div style={{fontSize:"14px",fontWeight:800,color:T.greenDark}}>Identity Verified</div>
              <div style={{fontSize:"12px",color:T.greenDark,marginTop:"2px",opacity:0.8}}>Your account is fully verified. You can now create and manage depots.</div>
            </div>
          </div>
          <SettingsBlock title="Submitted Documents">
            {KYC_DOCS.map(doc=>(
              <div key={doc.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${T.gray100}`}}>
                <div>
                  <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>{doc.label}</div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{doc.hint}</div>
                </div>
                <Badge status="delivered"/>
              </div>
            ))}
          </SettingsBlock>
        </div>
      );
      if(status==="submitted") return (
        <div>
          <div style={{background:"#fffbeb",border:"1px solid #f59e0b",padding:"18px 20px",display:"flex",alignItems:"center",gap:"14px",marginBottom:"24px"}}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div>
              <div style={{fontSize:"14px",fontWeight:800,color:"#92400e"}}>Under Review</div>
              <div style={{fontSize:"12px",color:"#92400e",marginTop:"2px",opacity:0.8}}>Your documents are being reviewed. This typically takes 1–3 business days.</div>
            </div>
          </div>
          <SettingsBlock title="Submitted Documents">
            {KYC_DOCS.map(doc=>(
              <div key={doc.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${T.gray100}`}}>
                <div>
                  <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>{doc.label}</div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{doc.hint}</div>
                </div>
                <Badge status="pending"/>
              </div>
            ))}
          </SettingsBlock>
        </div>
      );
      return (
        <div>
          <div style={{background:T.gray50,border:`1px solid ${T.gray100}`,padding:"16px 18px",marginBottom:"22px"}}>
            <div style={{fontSize:"13px",fontWeight:800,color:T.black,marginBottom:"6px"}}>Identity Verification (KYC)</div>
            <div style={{fontSize:"12px",color:T.gray400,lineHeight:1.6}}>
              Upload the required documents to verify your identity. All documents are encrypted and stored securely.
              Verification is required before you can create or manage depots.
            </div>
            <div style={{marginTop:"12px",display:"flex",alignItems:"center",gap:"10px"}}>
              <div style={{flex:1,height:"4px",background:T.gray100,borderRadius:"2px",overflow:"hidden"}}>
                <div style={{width:`${(kycDoneCount/kycReqDocs.length)*100}%`,height:"100%",background:kycAllDone?T.green:T.black,transition:"width 0.4s"}}/>
              </div>
              <div style={{fontSize:"11px",fontWeight:700,color:T.gray400,flexShrink:0}}>{kycDoneCount}/{kycReqDocs.length} uploaded</div>
            </div>
          </div>
          <SettingsBlock title="Required Documents">
            {KYC_DOCS.map(doc=>{
              const uploaded=kycUploaded[doc.key];
              const uploading=kycUploading[doc.key];
              const err=kycUploadErr[doc.key];
              return(
                <div key={doc.key} style={{padding:"14px 0",borderBottom:`1px solid ${T.gray100}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px",flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:"7px",flexWrap:"wrap"}}>
                        <span style={{fontSize:"13px",fontWeight:700,color:T.black}}>{doc.label}</span>
                        {doc.required&&<span style={{fontSize:"9px",fontWeight:800,color:T.red,background:"#fff1f2",padding:"2px 6px"}}>REQUIRED</span>}
                        {uploaded&&<span style={{fontSize:"9px",fontWeight:800,color:T.green,background:T.greenLight,padding:"2px 6px"}}>✓ UPLOADED</span>}
                      </div>
                      <div style={{fontSize:"11px",color:T.gray400,marginTop:"3px"}}>{doc.hint}</div>
                      {uploaded&&<div style={{fontSize:"11px",color:T.gray400,marginTop:"3px",fontStyle:"italic"}}>{uploaded}</div>}
                      {err&&<div style={{fontSize:"11px",color:T.red,marginTop:"4px",fontWeight:600}}>{err}</div>}
                    </div>
                    <label style={{flexShrink:0,cursor:uploading?"not-allowed":"pointer"}}>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{display:"none"}}
                        disabled={uploading}
                        onChange={e=>{const f=e.target.files?.[0];if(f)handleKycUpload(doc,f);e.target.value="";}}
                      />
                      <div style={{background:uploaded?T.white:T.black,color:uploaded?T.black:T.white,border:`1px solid ${uploaded?T.gray200:T.black}`,padding:"8px 14px",fontSize:"11px",fontWeight:800,fontFamily:F,minWidth:"90px",textAlign:"center",opacity:uploading?0.6:1,minHeight:"36px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {uploading?"Uploading…":uploaded?"Re-upload":"Upload"}
                      </div>
                    </label>
                  </div>
                </div>
              );
            })}
          </SettingsBlock>
          {kycSubmitErr&&<div style={{color:T.red,fontSize:"12px",fontWeight:600,marginBottom:"10px"}}>{kycSubmitErr}</div>}
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:"20px"}}>
            <button
              disabled={!kycAllDone||kycSubmitting}
              onClick={handleKycSubmit}
              style={{background:kycAllDone?(kycSubmitting?"#6b7280":T.black):T.gray200,color:kycAllDone?T.white:T.gray400,border:"none",padding:"13px 28px",fontSize:"13px",fontWeight:800,cursor:kycAllDone&&!kycSubmitting?"pointer":"not-allowed",fontFamily:F,minHeight:"46px",transition:"background 0.2s"}}
            >
              {kycSubmitting?"Submitting…":"Submit for Verification →"}
            </button>
          </div>
          <div style={{fontSize:"11px",color:T.gray400,marginTop:"10px",textAlign:"right"}}>PDF, JPEG, PNG or WebP · max 10 MB per file</div>
        </div>
      );
    })(),
  };

  const activeTab=TABS.find(t=>t.id===tab);
  const SUBTITLES={
    profile:"Account information and verification documents",
    notifications:"Control which alerts you receive and how",
    wallet:"Multi-currency wallet, bank accounts, and spending limits",
    bays:"Configure bay availability, hours, and products",
    products:"Add, remove, and configure products available at this depot",
    team:"Manage team members and their access levels",
    security:"Password, 2FA, sessions, and API credentials",
    verification:"Upload KYC documents to verify your identity",
  };

  return (
    <div style={{display:"flex",gap:"20px",alignItems:"flex-start",flexDirection:isMobile?"column":"row"}}>
      <div style={{width:isMobile?"100%":"196px",flexShrink:0}}>
        <div style={{background:T.white,border:`1px solid ${T.gray100}`,overflow:"hidden"}}>
          {TABS.map((t,i)=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:"9px",padding:"12px 14px",background:tab===t.id?T.black:T.white,color:tab===t.id?T.white:T.gray600,border:"none",borderBottom:i<TABS.length-1?`1px solid ${T.gray100}`:"none",cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:tab===t.id?800:600,textAlign:"left"}}>
              <Icon d={t.icon} size={14}/>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{marginBottom:"20px"}}>
          <div style={{fontSize:"16px",fontWeight:800,color:T.black}}>{activeTab?.label}</div>
          <div style={{fontSize:"11px",color:T.gray400,marginTop:"3px"}}>{SUBTITLES[tab]}</div>
        </div>
        {content[tab]}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   CREATE DEPOT FLOW
════════════════════════════════════════════ */
// Defined at module level so its identity is stable across renders (avoids focus-loss bug)
function DepotFormInput({label,value,onChange,type="text",hint,placeholder}) {
  return (
    <div style={{marginBottom:"16px"}}>
      <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>{label}</div>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 14px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}
        onFocus={e=>e.target.style.borderColor=T.black} onBlur={e=>e.target.style.borderColor=T.gray200}/>
      {hint&&<div style={{fontSize:"10px",color:T.gray400,marginTop:"4px",fontWeight:600}}>{hint}</div>}
    </div>
  );
}

const KYB_DOCS=[
  {key:"nmdpra_license",  label:"NMDPRA License Certificate",        required:true,  hint:"Current, unexpired license from the Dept. of Petroleum Resources"},
  {key:"cac_cert",        label:"CAC Registration (Form C02/C07)",   required:true,  hint:"Certificate of Incorporation from the Corporate Affairs Commission"},
  {key:"tax_clearance",   label:"FIRS Tax Clearance Certificate",    required:true,  hint:"Tax clearance for the last 3 fiscal years"},
  {key:"env_permit",      label:"DPR Environmental Permit",          required:true,  hint:"Valid environmental permit for the depot facility"},
  {key:"proof_of_address",label:"Utility Bill (Depot Address)",      required:false, hint:"Recent bill confirming the depot's physical address"},
];

function CreateDepotFlow({onCreateDepot,onDone,onCancel,isMobile}) {
  const {user}=useAuthStore();
  const [step,setStep]=useState(1);
  const [form,setForm]=useState({name:"",location:"",state:"",lga:"",address:"",license:"",expiry:"",products:[],capacity:"",contactName:"",contactPhone:"",contactEmail:"",contactRole:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const toggleProduct=p=>set("products",form.products.includes(p)?form.products.filter(x=>x!==p):[...form.products,p]);

  // Created depot (set after step 3 → 4 transition)
  const [createdDepot,setCreatedDepot]=useState(null);
  const [creating,setCreating]=useState(false);
  const [createErr,setCreateErr]=useState("");

  // KYB doc upload state
  const [uploaded,setUploaded]=useState({});   // { key: filename }
  const [uploading,setUploading]=useState({});
  const [uploadErr,setUploadErr]=useState({});

  // KYB submit state
  const [submitting,setSubmitting]=useState(false);
  const [submitErr,setSubmitErr]=useState("");
  const [submitted,setSubmitted]=useState(false);

  const canStep1=form.name.trim()&&form.location.trim()&&form.state.trim();
  const canStep2=form.license.trim()&&form.expiry&&form.products.length>0;
  const canStep3=form.contactName.trim()&&form.contactPhone.trim();
  const reqDocs=KYB_DOCS.filter(d=>d.required);
  const allRequiredUploaded=reqDocs.every(d=>uploaded[d.key]);

  const LABELS=["Details","License","Contact","Documents","Submit"];

  const goToKYB=async()=>{
    if(!canStep3) return;
    setCreating(true);
    setCreateErr("");
    try{
      // ── Diagnostic: verify session before attempting insert ──
      const {data:{session},error:sessErr}=await supabase.auth.getSession();
      console.log('[CreateDepot] session:', session?.user?.id, 'sessErr:', sessErr);
      if(!session) throw new Error('Session expired — please sign out and sign back in.');
      // ── End diagnostic ──
      const depot=await onCreateDepot(form);
      setCreatedDepot(depot);
      setStep(4);
    }catch(e){
      console.error('[CreateDepotFlow] create failed:', e.name, e.message, e);
      setCreateErr(e.message||"Failed to create depot. Please try again.");
    }finally{
      setCreating(false);
    }
  };

  const handleUpload=async(doc,file)=>{
    if(!file||!user||!createdDepot) return;
    setUploading(u=>({...u,[doc.key]:true}));
    setUploadErr(e=>({...e,[doc.key]:""}));
    try{
      await kybApi.uploadDocument(createdDepot.id,user.id,doc.key,file);
      setUploaded(u=>({...u,[doc.key]:file.name}));
    }catch(e){
      setUploadErr(err=>({...err,[doc.key]:e.message||"Upload failed"}));
    }finally{
      setUploading(u=>({...u,[doc.key]:false}));
    }
  };

  const handleSubmitKYB=async()=>{
    if(!createdDepot) return;
    setSubmitting(true);
    setSubmitErr("");
    try{
      await kybApi.submit(createdDepot.id);
      setSubmitted(true);
    }catch(e){
      setSubmitErr(e.message||"Submission failed. Try again.");
    }finally{
      setSubmitting(false);
    }
  };

  const btnBase={border:"none",fontFamily:F,cursor:"pointer",width:"100%",minHeight:"48px",fontSize:"13px",fontWeight:800,padding:"13px"};

  return (
    <div style={{maxWidth:"560px",margin:"0 auto",padding:isMobile?"0":"0 8px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"24px"}}>
        <div style={{fontSize:"18px",fontWeight:800,color:T.black}}>Create New Depot</div>
        <button onClick={onCancel} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,padding:0}}>Cancel ✕</button>
      </div>

      {/* Step indicator */}
      <div style={{display:"flex",alignItems:"center",marginBottom:"28px"}}>
        {LABELS.map((s,i,arr)=>(
          <div key={s} style={{display:"flex",alignItems:"center",flex:i<arr.length-1?"1":"0"}}>
            <div style={{display:"flex",alignItems:"center",gap:"6px",whiteSpace:"nowrap"}}>
              <div style={{width:"24px",height:"24px",borderRadius:"50%",background:step>i+1?T.green:step===i+1?T.black:T.gray200,color:step>=i+1?T.white:T.gray400,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:800,flexShrink:0,transition:"all 0.2s"}}>{step>i+1?"✓":i+1}</div>
              {!isMobile&&<span style={{fontSize:"11px",fontWeight:700,color:step===i+1?T.black:T.gray400}}>{s}</span>}
            </div>
            {i<arr.length-1&&<div style={{flex:1,height:"2px",background:step>i+1?T.green:T.gray200,margin:"0 8px",transition:"background 0.2s"}}/>}
          </div>
        ))}
      </div>

      {/* Step 1: Depot Details */}
      {step===1&&(
        <div>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"18px"}}>Depot Details</div>
          <DepotFormInput label="Depot Name" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Nepal Energies" hint="Official registered name of your depot"/>
          <DepotFormInput label="State *" value={form.state} onChange={e=>set("state",e.target.value)} placeholder="e.g. Lagos" hint="Nigerian state where the depot is located"/>
          <DepotFormInput label="City / LGA" value={form.location} onChange={e=>set("location",e.target.value)} placeholder="e.g. Apapa"/>
          <DepotFormInput label="Full Address" value={form.address} onChange={e=>set("address",e.target.value)} placeholder="e.g. Tank Farm Road, Apapa, Lagos"/>
          <button disabled={!canStep1} onClick={()=>setStep(2)} style={{...btnBase,background:canStep1?T.black:T.gray200,color:canStep1?T.white:T.gray400,cursor:canStep1?"pointer":"not-allowed"}}>Continue →</button>
        </div>
      )}

      {/* Step 2: License & Products */}
      {step===2&&(
        <div>
          <button onClick={()=>setStep(1)} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,marginBottom:"14px",padding:0}}>← Back</button>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"18px"}}>License & Products</div>
          <DepotFormInput label="NMDPRA License No." value={form.license} onChange={e=>set("license",e.target.value)} placeholder="e.g. DL-2024-APR-0099" hint="Department of Petroleum Resources license number"/>
          <DepotFormInput label="License Expiry Date" value={form.expiry} onChange={e=>set("expiry",e.target.value)} type="date"/>
          <DepotFormInput label="Tank Capacity (Litres)" value={form.capacity} onChange={e=>set("capacity",e.target.value)} type="number" placeholder="e.g. 85000"/>
          <div style={{marginBottom:"16px"}}>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Products Handled</div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
              {["PMS","AGO","DPK","LPG"].map(p=>{const on=form.products.includes(p);return(
                <button key={p} onClick={()=>toggleProduct(p)} style={{padding:"9px 18px",border:`2px solid ${on?T.black:T.gray200}`,background:on?T.black:T.white,color:on?T.white:T.gray400,fontFamily:F,fontSize:"13px",fontWeight:800,cursor:"pointer"}}>{p}</button>
              );})}
            </div>
          </div>
          <button disabled={!canStep2} onClick={()=>setStep(3)} style={{...btnBase,background:canStep2?T.black:T.gray200,color:canStep2?T.white:T.gray400,cursor:canStep2?"pointer":"not-allowed"}}>Continue →</button>
        </div>
      )}

      {/* Step 3: Operations Contact */}
      {step===3&&(
        <div>
          <button onClick={()=>setStep(2)} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,marginBottom:"14px",padding:0}}>← Back</button>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"4px"}}>Operations Contact</div>
          <div style={{fontSize:"12px",color:T.gray400,marginBottom:"20px"}}>Person responsible for day-to-day depot operations.</div>
          <DepotFormInput label="Full Name *" value={form.contactName} onChange={e=>set("contactName",e.target.value)} placeholder="e.g. Aminu Bello"/>
          <DepotFormInput label="Phone Number *" value={form.contactPhone} onChange={e=>set("contactPhone",e.target.value)} placeholder="e.g. +234 803 000 0000" hint="Must be reachable during loading operations"/>
          <DepotFormInput label="Email Address" value={form.contactEmail} onChange={e=>set("contactEmail",e.target.value)} placeholder="e.g. ops@nepalenergies.ng" type="email"/>
          <DepotFormInput label="Role / Designation" value={form.contactRole} onChange={e=>set("contactRole",e.target.value)} placeholder="e.g. Operations Manager"/>
          {createErr&&<div style={{color:"#c0392b",fontSize:"12px",fontWeight:600,marginBottom:"12px",padding:"10px 14px",background:"#fef2f2",border:"1px solid #fca5a5"}}>{createErr}</div>}
          <button disabled={!canStep3||creating} onClick={goToKYB} style={{...btnBase,background:canStep3&&!creating?T.black:T.gray200,color:canStep3&&!creating?T.white:T.gray400,cursor:canStep3&&!creating?"pointer":"not-allowed"}}>
            {creating?"Creating depot…":"Continue →"}
          </button>
        </div>
      )}

      {/* Step 4: KYB Documents */}
      {step===4&&(
        <div>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"4px"}}>KYB Documents</div>
          <div style={{fontSize:"12px",color:T.gray400,marginBottom:"16px"}}>Upload required documents to verify your depot. Required docs are marked with *.</div>
          <div style={{background:T.amberLight,border:`1px solid ${T.amber}`,padding:"11px 14px",marginBottom:"18px",fontSize:"11px",color:"#8A5C00",fontWeight:600}}>
            Depot created. Upload documents now or skip and submit them later from the KYB tab.
          </div>
          {KYB_DOCS.map(doc=>{
            const isUploaded=!!uploaded[doc.key];
            const isUploading=!!uploading[doc.key];
            const err=uploadErr[doc.key];
            return(
              <div key={doc.key} style={{border:`1px solid ${isUploaded?T.green:T.gray200}`,padding:"14px 16px",marginBottom:"10px",background:isUploaded?T.greenLight:T.white}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"12px",fontWeight:800,color:T.black,marginBottom:"2px"}}>{doc.label}{doc.required&&<span style={{color:"#c0392b"}}> *</span>}</div>
                    <div style={{fontSize:"11px",color:T.gray400,marginBottom:"6px"}}>{doc.hint}</div>
                    {isUploaded&&<div style={{fontSize:"11px",color:T.green,fontWeight:700}}>✓ {uploaded[doc.key]}</div>}
                    {err&&<div style={{fontSize:"11px",color:"#c0392b",fontWeight:600}}>{err}</div>}
                  </div>
                  <label style={{flexShrink:0,cursor:isUploading?"not-allowed":"pointer"}}>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:"none"}} disabled={isUploading} onChange={e=>{const f=e.target.files?.[0];if(f)handleUpload(doc,f);e.target.value="";}}/>
                    <div style={{padding:"7px 14px",border:`1px solid ${isUploaded?T.green:T.gray200}`,background:isUploaded?T.green:T.white,color:isUploaded?T.white:T.black,fontSize:"11px",fontWeight:800,whiteSpace:"nowrap"}}>
                      {isUploading?"Uploading…":isUploaded?"Replace":"Upload"}
                    </div>
                  </label>
                </div>
              </div>
            );
          })}
          <div style={{display:"flex",gap:"10px",marginTop:"8px"}}>
            <button onClick={()=>setStep(5)} style={{...btnBase,background:T.gray100,color:T.gray400,flex:"0 0 auto",width:"auto",padding:"13px 20px"}}>Skip for now</button>
            <button disabled={!allRequiredUploaded} onClick={()=>setStep(5)} style={{...btnBase,flex:1,background:allRequiredUploaded?T.green:T.gray200,color:allRequiredUploaded?T.white:T.gray400,cursor:allRequiredUploaded?"pointer":"not-allowed"}}>
              Review & Submit →
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Review & Submit */}
      {step===5&&(
        <div>
          {!submitted?(
            <>
              <button onClick={()=>setStep(4)} style={{background:"none",border:"none",color:T.gray400,cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:700,marginBottom:"14px",padding:0}}>← Back</button>
              <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"16px"}}>Review & Submit</div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Depot Info</div>
              <div style={{border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
                {[["Depot Name",form.name],["Location",form.location],["Address",form.address||"—"],["NMDPRA License",form.license],["License Expiry",form.expiry||"—"],["Capacity",form.capacity?`${Number(form.capacity).toLocaleString()} L`:"—"],["Products",form.products.join(", ")||"—"]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${T.gray100}`,fontSize:"12px"}}>
                    <span style={{color:T.gray400,fontWeight:600}}>{k}</span><span style={{color:T.black,fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Operations Contact</div>
              <div style={{border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
                {[["Name",form.contactName],["Phone",form.contactPhone],["Email",form.contactEmail||"—"],["Role",form.contactRole||"—"]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${T.gray100}`,fontSize:"12px"}}>
                    <span style={{color:T.gray400,fontWeight:600}}>{k}</span><span style={{color:T.black,fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>Documents</div>
              <div style={{border:`1px solid ${T.gray100}`,marginBottom:"16px"}}>
                {KYB_DOCS.map(doc=>{
                  const done=!!uploaded[doc.key];
                  return(
                    <div key={doc.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderBottom:`1px solid ${T.gray100}`,fontSize:"12px"}}>
                      <span style={{color:T.gray400,fontWeight:600}}>{doc.label}{doc.required&&<span style={{color:"#c0392b"}}> *</span>}</span>
                      <span style={{color:done?T.green:"#c0392b",fontWeight:800}}>{done?"✓ Uploaded":doc.required?"Missing":"—"}</span>
                    </div>
                  );
                })}
              </div>
              {!allRequiredUploaded&&(
                <div style={{background:"#fef2f2",border:"1px solid #fca5a5",padding:"11px 14px",marginBottom:"14px",fontSize:"11px",color:"#c0392b",fontWeight:600}}>
                  Some required documents are missing. You can still submit the depot for KYB review later from the KYB tab.
                </div>
              )}
              {submitErr&&<div style={{color:"#c0392b",fontSize:"12px",fontWeight:600,marginBottom:"12px",padding:"10px 14px",background:"#fef2f2",border:"1px solid #fca5a5"}}>{submitErr}</div>}
              <div style={{display:"flex",gap:"10px"}}>
                {!allRequiredUploaded&&(
                  <button onClick={()=>onDone(createdDepot?.id)} style={{...btnBase,background:T.gray100,color:T.black,flex:"0 0 auto",width:"auto",padding:"13px 20px"}}>Go to Depot</button>
                )}
                <button disabled={!allRequiredUploaded||submitting} onClick={handleSubmitKYB} style={{...btnBase,flex:1,background:allRequiredUploaded&&!submitting?T.green:T.gray200,color:allRequiredUploaded&&!submitting?T.white:T.gray400,cursor:allRequiredUploaded&&!submitting?"pointer":"not-allowed"}}>
                  {submitting?"Submitting…":"Submit for KYB Review →"}
                </button>
              </div>
            </>
          ):(
            <div style={{textAlign:"center",padding:"32px 20px"}}>
              <div style={{width:"56px",height:"56px",background:T.greenLight,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:"22px"}}>✓</div>
              <div style={{fontSize:"18px",fontWeight:800,color:T.black,marginBottom:"6px"}}>Documents Submitted!</div>
              <div style={{fontSize:"13px",color:T.gray400,maxWidth:"360px",margin:"0 auto 24px"}}>Your KYB documents are under review. Verification typically takes 1–3 business days. You'll receive an SMS and email when approved.</div>
              <div style={{border:`1px solid ${T.gray100}`,background:T.white,padding:"14px 18px",marginBottom:"24px",textAlign:"left"}}>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"8px"}}>Review Timeline</div>
                {[["Submitted","Now",T.green],["Document Check","Day 1",T.gray400],["Compliance Review","Day 1–2",T.gray400],["Approval","Day 2–3",T.gray400]].map(([l,t,c])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:"12px",padding:"6px 0",borderBottom:`1px solid ${T.gray100}`}}>
                    <span style={{fontWeight:600,color:T.black}}>{l}</span><span style={{color:c,fontWeight:700}}>{t}</span>
                  </div>
                ))}
              </div>
              <button onClick={()=>onDone(createdDepot?.id)} style={{...btnBase,background:T.black,color:T.white}}>Go to Depot →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   DEPOT KYB VIEW
════════════════════════════════════════════ */
function DepotKYBView({depot,isMobile}) {
  const {user}=useAuthStore();
  const {loadOwnerDepots}=useVentrylStore();
  const [files,setFiles]=useState({});       // { key: File }
  const [uploaded,setUploaded]=useState({}); // { key: filename } — confirmed uploads
  const [uploading,setUploading]=useState({});
  const [uploadErr,setUploadErr]=useState({});
  const [submitting,setSubmitting]=useState(false);
  const [submitted,setSubmitted]=useState(depot.kyb==="submitted"||depot.kyb==="verified");
  const [submitErr,setSubmitErr]=useState("");
  const [loadingDocs,setLoadingDocs]=useState(true);

  // Load already-uploaded docs from DB on mount
  useEffect(()=>{
    if(!depot.id){setLoadingDocs(false);return;}
    (async()=>{
      const {data}=await supabase.from("kyb_documents").select("type,file_name").eq("depot_id",depot.id);
      if(data&&data.length>0){
        const map={};
        data.forEach(d=>{map[d.type]=d.file_name;});
        setUploaded(map);
      }
      setLoadingDocs(false);
    })();
  },[depot.id]);

  const DOCS=[
    {key:"nmdpra_license",  label:"NMDPRA License Certificate",        required:true,  hint:"Current, unexpired license from the Dept. of Petroleum Resources"},
    {key:"cac_cert",        label:"CAC Registration (Form C02/C07)",   required:true,  hint:"Certificate of Incorporation from the Corporate Affairs Commission"},
    {key:"tax_clearance",   label:"FIRS Tax Clearance Certificate",    required:true,  hint:"Tax clearance for the last 3 fiscal years"},
    {key:"env_permit",      label:"DPR Environmental Permit",          required:true,  hint:"Valid environmental permit for the depot facility"},
    {key:"proof_of_address",label:"Utility Bill (Depot Address)",      required:false, hint:"Recent bill confirming the depot's physical address"},
  ];
  const reqDocs=DOCS.filter(d=>d.required);
  const doneCount=reqDocs.filter(d=>uploaded[d.key]).length;
  const allRequired=doneCount===reqDocs.length;

  const handleUpload=async(doc,file)=>{
    if(!file||!user) return;
    setUploading(u=>({...u,[doc.key]:true}));
    setUploadErr(e=>({...e,[doc.key]:""}));
    try{
      await kybApi.uploadDocument(depot.id,user.id,doc.key,file);
      setUploaded(u=>({...u,[doc.key]:file.name}));
      setFiles(f=>({...f,[doc.key]:file}));
    }catch(e){
      setUploadErr(err=>({...err,[doc.key]:e.message||"Upload failed"}));
    }finally{
      setUploading(u=>({...u,[doc.key]:false}));
    }
  };

  const handleSubmit=async()=>{
    if(!allRequired||!depot.id) return;
    setSubmitting(true);
    setSubmitErr("");
    try{
      await kybApi.submit(depot.id);
      setSubmitted(true);
      if(user?.id) loadOwnerDepots(user.id); // refresh store so depot.kyb reflects 'submitted'
    }catch(e){
      setSubmitErr(e.message||"Submission failed. Try again.");
    }finally{
      setSubmitting(false);
    }
  };

  if(loadingDocs) return <div style={{padding:"40px",textAlign:"center",fontSize:"12px",color:T.gray400,fontFamily:F}}>Loading documents…</div>;

  if(submitted) return (
    <div style={{textAlign:"center",padding:"40px 20px"}}>
      <div style={{width:"56px",height:"56px",background:T.greenLight,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:"22px"}}>✓</div>
      <div style={{fontSize:"18px",fontWeight:800,color:T.black,marginBottom:"6px"}}>Documents Submitted</div>
      <div style={{fontSize:"13px",color:T.gray400,maxWidth:"360px",margin:"0 auto 24px"}}>Your KYB documents are under review. Verification typically takes 1–3 business days. You'll receive an SMS and email when approved.</div>
      <div style={{border:`1px solid ${T.gray100}`,background:T.white,padding:"14px 18px",display:"inline-block",textAlign:"left",minWidth:"240px"}}>
        <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"8px"}}>Review Timeline</div>
        {[["Submitted","Now",T.green],["Document Check","Day 1",T.gray400],["Compliance Review","Day 1–2",T.gray400],["Approval","Day 2–3",T.gray400]].map(([l,t,c])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:"12px",padding:"6px 0",borderBottom:`1px solid ${T.gray100}`}}>
            <span style={{fontWeight:600,color:T.black}}>{l}</span><span style={{color:c,fontWeight:700}}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{background:T.amberLight,border:`1px solid ${T.amber}`,padding:"14px 18px",marginBottom:"20px"}}>
        <div style={{fontSize:"12px",fontWeight:800,color:"#8A5C00",marginBottom:"2px"}}>KYB Verification Required</div>
        <div style={{fontSize:"11px",color:"#8A5C00"}}>{depot.name} cannot receive orders until KYB documents are approved by Ventryl.</div>
      </div>

      {DOCS.map(doc=>{
        const done=!!uploaded[doc.key];
        const busy=!!uploading[doc.key];
        const err=uploadErr[doc.key];
        return (
          <div key={doc.key} style={{border:`1px solid ${done?T.green:err?T.red:T.gray100}`,background:T.white,padding:"16px",marginBottom:"10px",transition:"border-color 0.2s"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"3px",flexWrap:"wrap"}}>
                  <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>{doc.label}</span>
                  {doc.required&&<span style={{background:T.redLight,color:T.red,fontSize:"9px",fontWeight:800,padding:"1px 5px"}}>REQUIRED</span>}
                </div>
                <div style={{fontSize:"11px",color:T.gray400}}>{doc.hint}</div>
                {done&&<div style={{fontSize:"11px",color:T.greenDark,fontWeight:700,marginTop:"5px"}}>✓ {uploaded[doc.key]}</div>}
                {err&&<div style={{fontSize:"11px",color:T.red,fontWeight:700,marginTop:"5px"}}>{err}</div>}
                {busy&&<div style={{fontSize:"11px",color:T.blue,fontWeight:700,marginTop:"5px"}}>Uploading…</div>}
              </div>
              <label style={{background:busy?T.gray200:done?T.greenLight:T.black,color:busy?T.gray400:done?T.greenDark:T.white,padding:"8px 16px",fontSize:"11px",fontWeight:800,cursor:busy?"not-allowed":"pointer",fontFamily:F,flexShrink:0,minHeight:"38px",display:"flex",alignItems:"center",border:"none"}}>
                {busy?"Uploading…":done?"✓ Replace":"Upload"}
                <input type="file" style={{display:"none"}} accept=".pdf,.jpg,.jpeg,.png" disabled={busy}
                  onChange={e=>e.target.files[0]&&handleUpload(doc,e.target.files[0])}/>
              </label>
            </div>
          </div>
        );
      })}

      <div style={{marginTop:"20px"}}>
        <div style={{fontSize:"11px",color:T.gray400,marginBottom:"8px",fontWeight:600}}>{doneCount}/{reqDocs.length} required documents uploaded</div>
        <div style={{height:"4px",background:T.gray100,borderRadius:"2px",overflow:"hidden",marginBottom:"16px"}}>
          <div style={{height:"100%",width:`${reqDocs.length>0?(doneCount/reqDocs.length)*100:0}%`,background:allRequired?T.green:T.amber,transition:"width 0.3s"}}/>
        </div>
        {submitErr&&<div style={{fontSize:"12px",color:T.red,fontWeight:700,marginBottom:"10px"}}>{submitErr}</div>}
        <button disabled={!allRequired||submitting} onClick={handleSubmit}
          style={{background:allRequired&&!submitting?T.black:T.gray200,color:allRequired&&!submitting?T.white:T.gray400,border:"none",padding:"13px",fontSize:"13px",fontWeight:800,cursor:allRequired&&!submitting?"pointer":"not-allowed",fontFamily:F,width:"100%",minHeight:"48px"}}>
          {submitting?"Submitting…":"Submit for Verification →"}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   DEPOT DETAIL VIEW
════════════════════════════════════════════ */
/* ════════════════════════════════════════════
   DEPOT OVERVIEW
════════════════════════════════════════════ */
/* ════════════════════════════════════════════
   ORDER INBOX PANEL (shared — dash + depot overview)
════════════════════════════════════════════ */
function OrderInboxPanel({incoming,isMobile,depot,onViewOrder}) {
  const [acted,setActed]=useState({});
  // For depot overview: filter to matching depot; for dashboard: show all
  const relevant = depot
    ? incoming.filter(o=>!depot.name||o.depot===depot.name||true)
    : incoming;
  const pending = relevant.filter(o=>o.status==="pending"&&!acted[o.id]);
  const confirmed = relevant.filter(o=>o.status==="confirmed"||acted[o.id]==="confirm");
  const newCount = pending.length;
  if(relevant.length===0) return null;
  return (
    <Card style={{marginBottom:"14px"}} pad={false}>
      <div style={{padding:"14px 16px 0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>Order Inbox</span>
          {newCount>0&&(
            <span style={{
              background:T.red,color:T.white,
              fontSize:"10px",fontWeight:800,padding:"2px 8px",
              letterSpacing:"0.04em",animation:"pulse 1.6s infinite",
            }}>
              {newCount} NEW
            </span>
          )}
          {newCount===0&&confirmed.length>0&&(
            <span style={{background:T.greenLight,color:T.greenDark,fontSize:"10px",fontWeight:800,padding:"2px 8px"}}>{confirmed.length} confirmed</span>
          )}
        </div>
        {newCount>0&&<span style={{fontSize:"10px",color:"#8A5C00",fontWeight:700,background:T.amberLight,padding:"3px 8px"}}>⏱ Respond before SLA expires</span>}
      </div>
      <div style={{padding:"10px 16px 14px 16px"}}>
        {pending.map(o=>(
          <div key={o.id} onClick={()=>onViewOrder&&onViewOrder(o.id)}
            style={{border:`2px solid ${T.amber}`,background:T.white,marginBottom:"10px",position:"relative",cursor:onViewOrder?"pointer":"default",transition:"box-shadow 0.15s"}}
            onMouseEnter={e=>{if(onViewOrder)e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.10)";}}
            onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
            {/* NEW flag ribbon */}
            <div style={{position:"absolute",top:0,right:0,background:T.red,color:T.white,fontSize:"9px",fontWeight:800,padding:"3px 8px",letterSpacing:"0.06em",zIndex:1}}>NEW</div>
            <div style={{padding:"14px 16px 10px 16px"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"8px",gap:"10px",flexWrap:isMobile?"wrap":"nowrap"}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:"7px",flexWrap:"wrap",marginBottom:"4px"}}>
                    <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>{o.id}</span>
                    <span style={{background:T.gray100,color:T.gray600,fontSize:"10px",fontWeight:700,padding:"2px 6px"}}>{o.type}</span>
                  </div>
                  <div style={{fontSize:"13px",fontWeight:700,color:T.black,marginBottom:"1px"}}>{o.buyer}</div>
                  <div style={{fontSize:"11px",color:T.gray400}}>{o.location} · {o.submitted}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px 18px",flexShrink:0}}>
                  {[["Product",o.product],["Volume",`${(o.vol/1000).toFixed(0)}k L`],["Trucks",o.trucks],["Value",`₦${(o.value/1e6).toFixed(1)}M`]].map(([l,v])=>(
                    <div key={l}>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"1px"}}>{l}</div>
                      <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"8px",paddingTop:"10px",borderTop:`1px solid ${T.gray100}`}}>
                <span style={{fontSize:"11px",fontWeight:800,color:"#8A5C00",background:T.amberLight,padding:"3px 8px"}}>⏱ SLA: {o.slaLeft}</span>
                <div style={{display:"flex",gap:"7px"}}>
                  <button onClick={e=>{e.stopPropagation();setActed(a=>({...a,[o.id]:"reject"}));}} style={{background:T.white,color:T.red,border:`1px solid ${T.red}`,padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>Reject</button>
                  <button onClick={e=>{e.stopPropagation();setActed(a=>({...a,[o.id]:"confirm"}));}} style={{background:T.green,color:T.white,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>Confirm →</button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {confirmed.map(o=>(
          <div key={o.id} onClick={()=>onViewOrder&&onViewOrder(o.id)}
            style={{border:`1px solid ${T.gray100}`,background:T.white,padding:"12px 16px",marginBottom:"8px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"10px",flexWrap:"wrap",cursor:onViewOrder?"pointer":"default",transition:"border-color 0.15s,background 0.15s"}}
            onMouseEnter={e=>{if(onViewOrder){e.currentTarget.style.borderColor=T.black;e.currentTarget.style.background=T.gray50;}}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.gray100;e.currentTarget.style.background=T.white;}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"2px"}}>
                <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>{o.id}</span>
                <Badge status="confirmed"/>
              </div>
              <div style={{fontSize:"11px",color:T.gray400}}>{o.buyer} · {o.product} · {(o.vol/1000).toFixed(0)}k L · ₦{(o.value/1e6).toFixed(1)}M</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              <span style={{fontSize:"10px",fontWeight:700,color:T.gray400}}>{o.submitted}</span>
              {onViewOrder&&<span style={{fontSize:"10px",fontWeight:800,color:T.black}}>Manage →</span>}
            </div>
          </div>
        ))}
        {relevant.filter(o=>acted[o.id]==="reject").map(o=>(
          <div key={o.id} style={{border:`1px solid ${T.gray100}`,background:T.gray50,padding:"10px 16px",marginBottom:"8px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"10px",flexWrap:"wrap",opacity:0.6}}>
            <div>
              <div style={{fontSize:"11px",fontWeight:800,color:T.black}}>{o.id} <span style={{color:T.red}}>· Rejected</span></div>
              <div style={{fontSize:"10px",color:T.gray400}}>{o.buyer} · {o.product} · {(o.vol/1000).toFixed(0)}k L</div>
            </div>
          </div>
        ))}
        {relevant.length>0&&pending.length===0&&confirmed.length===0&&(
          <div style={{fontSize:"12px",color:T.gray400,padding:"12px 0",textAlign:"center"}}>No pending orders. New orders will appear here.</div>
        )}
      </div>
    </Card>
  );
}

function DepotOverview({depot,onUpdateDepot,onViewOrder,isMobile}) {
  const {depotOrders,loadDepotOrders}=useVentrylStore();
  useEffect(()=>{if(depot?.id)loadDepotOrders(depot.id);},[depot?.id]);
  const products=depot.products||[];
  const totalStockValue=products.reduce((s,p)=>s+(p.stock*p.pricePerLitre),0);
  const totalStock=products.reduce((s,p)=>s+p.stock,0);
  const lowStock=products.filter(p=>p.threshold>0&&p.stock<p.threshold);
  const DEPOT_ORDERS=depotOrders[depot?.id]||[];
  return (
    <div>
      {/* Stock KPI strip */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":`repeat(${Math.max(products.length+2,3)},1fr)`,gap:"1px",background:T.gray100,border:`1px solid ${T.gray100}`,marginBottom:"14px"}}>
        <KpiCard label="Total Stock" value={totalStock>=1000?`${(totalStock/1000).toFixed(0)}k L`:`${totalStock} L`} sub={`${products.length} product${products.length!==1?"s":""}`}/>
        <KpiCard label="Stock Value" value={`₦${(totalStockValue/1e6).toFixed(1)}M`} sub="At current prices"/>
        {products.map(p=>{
          const isLow=p.threshold>0&&p.stock<p.threshold;
          return <KpiCard key={p.id} label={p.name} value={p.stock>=1000?`${(p.stock/1000).toFixed(0)}k L`:`${p.stock} L`} sub={`₦${p.pricePerLitre}/L`} alert={isLow}/>;
        })}
        <KpiCard label="Orders" value={String(DEPOT_ORDERS.length||0)} sub={`${DEPOT_ORDERS.filter(o=>o.status==="in_transit").length} in transit`}/>
      </div>

      {/* Low stock alert */}
      {lowStock.length>0&&(
        <div style={{background:T.redLight,border:`1px solid ${T.red}`,padding:"12px 16px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:"12px",fontWeight:800,color:T.red}}>Low Stock Alert</div>
            <div style={{fontSize:"11px",color:T.red,marginTop:"2px"}}>{lowStock.map(p=>`${p.name} (${(p.stock/1000).toFixed(0)}k L remaining)`).join(" · ")}</div>
          </div>
          <button style={{background:T.red,color:T.white,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,flexShrink:0,minHeight:"34px"}}>Manage Stock →</button>
        </div>
      )}

      {/* ① ORDER INBOX — top priority */}
      <OrderInboxPanel incoming={DEPOT_ORDERS} isMobile={isMobile} depot={depot} onViewOrder={onViewOrder}/>

      {/* ② STOCK LEVELS */}
      {products.length>0?(
        <Card style={{marginBottom:"14px"}}>
          <SectionHead title="Stock Levels" sub={`Capacity: ${depot.capacity>0?depot.capacity.toLocaleString()+" L":"Not set"}`}/>
          {products.map((p,i)=>{
            const pct=depot.capacity>0?Math.min((p.stock/depot.capacity)*100,100):0;
            const isLow=p.threshold>0&&p.stock<p.threshold;
            const color=isLow?T.red:pct>60?T.green:T.amber;
            return (
              <div key={p.id} style={{marginBottom:i<products.length-1?"16px":"0"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <span style={{background:T.black,color:T.white,fontSize:"10px",fontWeight:800,padding:"2px 7px"}}>{p.name}</span>
                    {isLow&&<span style={{background:T.redLight,color:T.red,fontSize:"9px",fontWeight:800,padding:"1px 5px"}}>LOW</span>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>{p.stock>=1000?`${(p.stock/1000).toFixed(0)}k`:p.stock} L</span>
                    {depot.capacity>0&&<span style={{fontSize:"10px",color:T.gray400,marginLeft:"6px"}}>({pct.toFixed(0)}%)</span>}
                  </div>
                </div>
                <div style={{height:"8px",background:T.gray100,borderRadius:"4px",overflow:"hidden",position:"relative"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:"4px",transition:"width 0.3s"}}/>
                  {depot.capacity>0&&p.threshold>0&&(
                    <div style={{position:"absolute",top:0,bottom:0,left:`${(p.threshold/depot.capacity)*100}%`,width:"2px",background:"#8A5C00",opacity:0.6}}/>
                  )}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:"4px"}}>
                  <span style={{fontSize:"10px",color:T.gray400,fontWeight:600}}>₦{p.pricePerLitre.toLocaleString()}/L</span>
                  {depot.capacity>0&&p.threshold>0&&<span style={{fontSize:"10px",color:"#8A5C00",fontWeight:600}}>Alert at {(p.threshold/1000).toFixed(0)}k L</span>}
                </div>
              </div>
            );
          })}
        </Card>
      ):(
        <div style={{border:`1px dashed ${T.gray200}`,padding:"28px",textAlign:"center",marginBottom:"14px"}}>
          <div style={{fontSize:"13px",fontWeight:700,color:T.gray400,marginBottom:"4px"}}>No products configured</div>
          <div style={{fontSize:"11px",color:T.gray400}}>Go to the Inventory tab to add your first product.</div>
        </div>
      )}

      {/* ③ REVENUE + RECENT ORDERS */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.3fr 1fr",gap:"14px"}}>
        <Card>
          <SectionHead title="Revenue" sub="Lifetime orders"/>
          <div style={{padding:"20px 0",textAlign:"center"}}>
            <div style={{fontSize:"28px",fontWeight:800,color:T.green}}>₦{DEPOT_ORDERS.reduce((s,o)=>s+(o.value||0),0)>0?(DEPOT_ORDERS.reduce((s,o)=>s+(o.value||0),0)/1e6).toFixed(1)+"M":"—"}</div>
            <div style={{fontSize:"11px",color:T.gray400,marginTop:"4px"}}>{DEPOT_ORDERS.length} total orders · {DEPOT_ORDERS.filter(o=>o.status==="delivered"||o.status==="collected").length} delivered</div>
          </div>
        </Card>
        <Card>
          <SectionHead title="Recent Orders" sub={DEPOT_ORDERS.length>0?`${DEPOT_ORDERS.length} orders`:"No orders yet"}/>
          {DEPOT_ORDERS.length>0?DEPOT_ORDERS.map((o,i)=>(
            <div key={o.id} onClick={()=>onViewOrder&&onViewOrder(o.id)}
              style={{padding:"9px 0",borderBottom:i<DEPOT_ORDERS.length-1?`1px solid ${T.gray100}`:"none",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background=T.gray50}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div><div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{o.id}</div><div style={{fontSize:"11px",color:T.gray400,marginTop:"1px"}}>{o.buyer} · {o.product}</div></div>
                <Badge status={o.status}/>
              </div>
              <div style={{display:"flex",gap:"12px",marginTop:"4px"}}>
                <span style={{fontSize:"11px",color:T.gray600,fontWeight:700}}>{(o.vol/1000).toFixed(0)}k L</span>
                <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>₦{(o.value/1e6).toFixed(1)}M</span>
              </div>
            </div>
          )):(
            <div style={{fontSize:"12px",color:T.gray400,padding:"12px 0"}}>Orders will appear here once your depot goes live.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   PRODUCT CARD (Inventory)
════════════════════════════════════════════ */
function ProductCard({product,depot,onAddStock,onAdjustStock,onUpdatePrice,onUpdateThreshold,onRemove,isMobile}) {
  const [mode,setMode]=useState(null); // null | "add" | "adjust"
  const [addQty,setAddQty]=useState("");
  const [addRef,setAddRef]=useState("");
  const [adjQty,setAdjQty]=useState("");
  const [adjNote,setAdjNote]=useState("");
  const [editingPrice,setEditingPrice]=useState(false);
  const [tempPrice,setTempPrice]=useState(String(product.pricePerLitre));
  const [editingThreshold,setEditingThreshold]=useState(false);
  const [tempThreshold,setTempThreshold]=useState(String(product.threshold));
  const [confirmRemove,setConfirmRemove]=useState(false);

  const pct=depot.capacity>0?Math.min((product.stock/depot.capacity)*100,100):0;
  const isLow=product.threshold>0&&product.stock<product.threshold;
  const barColor=isLow?T.red:pct>60?T.green:T.amber;

  const submitAddStock=()=>{
    const qty=Number(addQty);
    if(!qty||qty<=0)return;
    onAddStock(product.id,qty,addRef||`DEL-${Date.now().toString().slice(-6)}`);
    setAddQty("");setAddRef("");setMode(null);
  };
  const submitAdjust=()=>{
    const qty=Number(adjQty);
    if(!qty)return;
    onAdjustStock(product.id,qty,adjNote);
    setAdjQty("");setAdjNote("");setMode(null);
  };

  return (
    <div style={{border:`1px solid ${isLow?T.red:T.gray100}`,background:T.white,marginBottom:"12px",transition:"border-color 0.2s"}}>
      {/* Header */}
      <div style={{padding:"16px",borderBottom:mode?`1px solid ${T.gray100}`:"none"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",marginBottom:"14px",flexWrap:isMobile?"wrap":"nowrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{background:T.black,color:T.white,fontSize:"12px",fontWeight:800,padding:"4px 10px"}}>{product.name}</div>
            {isLow&&<span style={{background:T.redLight,color:T.red,fontSize:"9px",fontWeight:800,padding:"2px 6px"}}>LOW STOCK</span>}
          </div>
          <div style={{display:"flex",gap:"6px",flexShrink:0,flexWrap:"wrap"}}>
            <button onClick={()=>setMode(mode==="add"?null:"add")} style={{background:mode==="add"?T.black:T.white,color:mode==="add"?T.white:T.black,border:`1px solid ${T.black}`,padding:"6px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>+ Add Stock</button>
            <button onClick={()=>setMode(mode==="adjust"?null:"adjust")} style={{background:mode==="adjust"?T.gray800:T.white,color:mode==="adjust"?T.white:T.gray600,border:`1px solid ${T.gray200}`,padding:"6px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>Adjust</button>
            {!confirmRemove?(
              <button onClick={()=>setConfirmRemove(true)} style={{background:"none",color:T.gray400,border:`1px solid ${T.gray200}`,padding:"6px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>✕</button>
            ):(
              <div style={{display:"flex",gap:"4px"}}>
                <button onClick={()=>onRemove(product.id)} style={{background:T.red,color:T.white,border:"none",padding:"6px 10px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>Remove</button>
                <button onClick={()=>setConfirmRemove(false)} style={{background:"none",color:T.gray400,border:`1px solid ${T.gray200}`,padding:"6px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"34px"}}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        {/* Stock level */}
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
          <span style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em"}}>Current Stock</span>
          <span style={{fontSize:"13px",fontWeight:800,color:isLow?T.red:T.black}}>
            {product.stock>=1000?`${(product.stock/1000).toFixed(1)}k`:product.stock} L
            {depot.capacity>0&&<span style={{fontSize:"10px",fontWeight:600,color:T.gray400,marginLeft:"6px"}}>({pct.toFixed(0)}% of capacity)</span>}
          </span>
        </div>
        <div style={{height:"10px",background:T.gray100,borderRadius:"5px",overflow:"hidden",position:"relative",marginBottom:"10px"}}>
          <div style={{height:"100%",width:`${pct}%`,background:barColor,borderRadius:"5px",transition:"width 0.4s"}}/>
          {depot.capacity>0&&product.threshold>0&&(
            <div style={{position:"absolute",top:0,bottom:0,left:`${Math.min((product.threshold/depot.capacity)*100,100)}%`,width:"2px",background:"#8A5C00"}}/>
          )}
        </div>

        {/* Editable fields */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"12px"}}>
          <div>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Price per Litre (₦)</div>
            {editingPrice?(
              <div style={{display:"flex",gap:"4px"}}>
                <input value={tempPrice} onChange={e=>setTempPrice(e.target.value)} type="number"
                  style={{flex:1,border:`1px solid ${T.black}`,padding:"7px 10px",fontFamily:F,fontSize:"13px",fontWeight:700,color:T.black,background:T.white,outline:"none"}}/>
                <button onClick={()=>{onUpdatePrice(product.id,Number(tempPrice));setEditingPrice(false);}} style={{background:T.black,color:T.white,border:"none",padding:"7px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F}}>Save</button>
                <button onClick={()=>{setTempPrice(String(product.pricePerLitre));setEditingPrice(false);}} style={{background:"none",border:`1px solid ${T.gray200}`,color:T.gray400,padding:"7px 10px",fontSize:"11px",cursor:"pointer",fontFamily:F}}>✕</button>
              </div>
            ):(
              <div onClick={()=>setEditingPrice(true)} style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",padding:"7px 10px",border:`1px solid ${T.gray100}`,background:T.gray50}}>
                <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>₦{product.pricePerLitre.toLocaleString()}</span>
                <span style={{fontSize:"10px",color:T.blue,fontWeight:700}}>Edit</span>
              </div>
            )}
          </div>
          <div>
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Low Stock Alert (L)</div>
            {editingThreshold?(
              <div style={{display:"flex",gap:"4px"}}>
                <input value={tempThreshold} onChange={e=>setTempThreshold(e.target.value)} type="number"
                  style={{flex:1,border:`1px solid ${T.black}`,padding:"7px 10px",fontFamily:F,fontSize:"13px",fontWeight:700,color:T.black,background:T.white,outline:"none"}}/>
                <button onClick={()=>{onUpdateThreshold(product.id,Number(tempThreshold));setEditingThreshold(false);}} style={{background:T.black,color:T.white,border:"none",padding:"7px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F}}>Save</button>
                <button onClick={()=>{setTempThreshold(String(product.threshold));setEditingThreshold(false);}} style={{background:"none",border:`1px solid ${T.gray200}`,color:T.gray400,padding:"7px 10px",fontSize:"11px",cursor:"pointer",fontFamily:F}}>✕</button>
              </div>
            ):(
              <div onClick={()=>setEditingThreshold(true)} style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",padding:"7px 10px",border:`1px solid ${T.gray100}`,background:T.gray50}}>
                <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>{product.threshold>=1000?`${(product.threshold/1000).toFixed(0)}k`:product.threshold} L</span>
                <span style={{fontSize:"10px",color:T.blue,fontWeight:700}}>Edit</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Stock panel */}
      {mode==="add"&&(
        <div style={{padding:"16px",background:T.gray50,borderTop:`1px solid ${T.gray100}`}}>
          <div style={{fontSize:"12px",fontWeight:800,color:T.black,marginBottom:"12px"}}>Add Stock — {product.name}</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"10px",marginBottom:"12px"}}>
            <div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Quantity (Litres)</div>
              <input type="number" value={addQty} onChange={e=>setAddQty(e.target.value)} placeholder="e.g. 33000"
                style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}
                onFocus={e=>e.target.style.borderColor=T.black} onBlur={e=>e.target.style.borderColor=T.gray200}/>
            </div>
            <div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Delivery Reference</div>
              <input type="text" value={addRef} onChange={e=>setAddRef(e.target.value)} placeholder="e.g. DEL-2026-041"
                style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}
                onFocus={e=>e.target.style.borderColor=T.black} onBlur={e=>e.target.style.borderColor=T.gray200}/>
            </div>
          </div>
          {addQty&&Number(addQty)>0&&(
            <div style={{background:T.greenLight,padding:"8px 12px",marginBottom:"10px",fontSize:"11px",color:T.greenDark,fontWeight:700}}>
              New stock: {((product.stock+Number(addQty))/1000).toFixed(1)}k L  ·  Value: ₦{((product.stock+Number(addQty))*product.pricePerLitre/1e6).toFixed(1)}M
            </div>
          )}
          <div style={{display:"flex",gap:"8px"}}>
            <button disabled={!addQty||Number(addQty)<=0} onClick={submitAddStock} style={{background:addQty&&Number(addQty)>0?T.green:T.gray200,color:addQty&&Number(addQty)>0?T.white:T.gray400,border:"none",padding:"10px 20px",fontSize:"12px",fontWeight:800,cursor:addQty&&Number(addQty)>0?"pointer":"not-allowed",fontFamily:F,minHeight:"42px"}}>Confirm Receipt</button>
            <button onClick={()=>setMode(null)} style={{background:"none",color:T.gray400,border:`1px solid ${T.gray200}`,padding:"10px 16px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"42px"}}>Cancel</button>
          </div>
        </div>
      )}

      {/* Adjust Stock panel */}
      {mode==="adjust"&&(
        <div style={{padding:"16px",background:"#FAFAFA",borderTop:`1px solid ${T.gray100}`}}>
          <div style={{fontSize:"12px",fontWeight:800,color:T.black,marginBottom:"4px"}}>Manual Adjustment — {product.name}</div>
          <div style={{fontSize:"11px",color:T.gray400,marginBottom:"12px"}}>Use positive values to increase, negative to decrease.</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"10px",marginBottom:"12px"}}>
            <div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Quantity (±L)</div>
              <input type="number" value={adjQty} onChange={e=>setAdjQty(e.target.value)} placeholder="e.g. -500 or +2000"
                style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}
                onFocus={e=>e.target.style.borderColor=T.black} onBlur={e=>e.target.style.borderColor=T.gray200}/>
            </div>
            <div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Reason / Note</div>
              <input type="text" value={adjNote} onChange={e=>setAdjNote(e.target.value)} placeholder="e.g. Meter calibration"
                style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"10px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}
                onFocus={e=>e.target.style.borderColor=T.black} onBlur={e=>e.target.style.borderColor=T.gray200}/>
            </div>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button disabled={!adjQty||Number(adjQty)===0} onClick={submitAdjust} style={{background:adjQty&&Number(adjQty)!==0?T.black:T.gray200,color:adjQty&&Number(adjQty)!==0?T.white:T.gray400,border:"none",padding:"10px 20px",fontSize:"12px",fontWeight:800,cursor:adjQty&&Number(adjQty)!==0?"pointer":"not-allowed",fontFamily:F,minHeight:"42px"}}>Apply Adjustment</button>
            <button onClick={()=>setMode(null)} style={{background:"none",color:T.gray400,border:`1px solid ${T.gray200}`,padding:"10px 16px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"42px"}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   DEPOT INVENTORY
════════════════════════════════════════════ */
function DepotInventory({depot,onUpdateDepot,isMobile}) {
  const [showAdd,setShowAdd]=useState(false);
  const [newP,setNewP]=useState({name:"",price:"",threshold:"5000",initStock:""});
  const AVAIL=["PMS","AGO","DPK","LPG","Jet-A1","Kerosene"].filter(n=>!(depot.products||[]).map(p=>p.name).includes(n));

  const handleAddStock=(productId,qty,ref)=>{
    const prod=(depot.products||[]).find(p=>p.id===productId);
    const updated=(depot.products||[]).map(p=>p.id===productId?{...p,stock:p.stock+qty}:p);
    const hist=[{id:Date.now(),date:new Date().toLocaleDateString("en-NG"),product:prod.name,qty,type:"delivery",ref},...(depot.stockHistory||[])];
    onUpdateDepot(depot.id,{products:updated,stockHistory:hist});
  };
  const handleAdjustStock=(productId,qty,note)=>{
    const prod=(depot.products||[]).find(p=>p.id===productId);
    const updated=(depot.products||[]).map(p=>p.id===productId?{...p,stock:Math.max(0,p.stock+qty)}:p);
    const hist=[{id:Date.now(),date:new Date().toLocaleDateString("en-NG"),product:prod.name,qty,type:"adjustment",ref:note||"Manual adjustment"},...(depot.stockHistory||[])];
    onUpdateDepot(depot.id,{products:updated,stockHistory:hist});
  };
  const handleUpdatePrice=(productId,price)=>{
    const updated=(depot.products||[]).map(p=>p.id===productId?{...p,pricePerLitre:Number(price)}:p);
    onUpdateDepot(depot.id,{products:updated});
  };
  const handleUpdateThreshold=(productId,threshold)=>{
    const updated=(depot.products||[]).map(p=>p.id===productId?{...p,threshold:Number(threshold)}:p);
    onUpdateDepot(depot.id,{products:updated});
  };
  const handleRemove=(productId)=>{
    const updated=(depot.products||[]).filter(p=>p.id!==productId);
    onUpdateDepot(depot.id,{products:updated});
  };
  const handleAddProduct=()=>{
    if(!newP.name.trim())return;
    const product={id:newP.name.toLowerCase().replace(/[^a-z0-9]/g,"_")+"_"+Date.now(),name:newP.name.trim(),pricePerLitre:Number(newP.price)||0,stock:Number(newP.initStock)||0,threshold:Number(newP.threshold)||5000};
    const hist=Number(newP.initStock)>0?[{id:Date.now(),date:new Date().toLocaleDateString("en-NG"),product:product.name,qty:Number(newP.initStock),type:"delivery",ref:"Initial stock"},...(depot.stockHistory||[])]:(depot.stockHistory||[]);
    onUpdateDepot(depot.id,{products:[...(depot.products||[]),product],stockHistory:hist});
    setShowAdd(false);setNewP({name:"",price:"",threshold:"5000",initStock:""});
  };

  return (
    <div>
      <SectionHead title="Products & Stock"
        sub={`${(depot.products||[]).length} product${(depot.products||[]).length!==1?"s":""} · Capacity: ${depot.capacity>0?depot.capacity.toLocaleString()+" L":"Not set"}`}
        right={<button onClick={()=>setShowAdd(!showAdd)} style={{background:T.black,color:T.white,border:"none",padding:"8px 16px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>{showAdd?"Cancel":"+ Add Product"}</button>}/>

      {/* Add product form */}
      {showAdd&&(
        <div style={{border:`1px solid ${T.black}`,background:T.white,padding:"18px",marginBottom:"14px"}}>
          <div style={{fontSize:"13px",fontWeight:800,color:T.black,marginBottom:"14px"}}>New Product</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
            <div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Product Name</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"6px"}}>
                {AVAIL.map(n=>(
                  <button key={n} onClick={()=>setNewP(p=>({...p,name:n}))} style={{padding:"6px 12px",border:`2px solid ${newP.name===n?T.black:T.gray200}`,background:newP.name===n?T.black:T.white,color:newP.name===n?T.white:T.gray600,fontFamily:F,fontSize:"12px",fontWeight:800,cursor:"pointer"}}>{n}</button>
                ))}
              </div>
              <input value={newP.name} onChange={e=>setNewP(p=>({...p,name:e.target.value}))} placeholder="Or type custom name"
                style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"8px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr",gap:"8px"}}>
              <div>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Price per Litre (₦)</div>
                <input type="number" value={newP.price} onChange={e=>setNewP(p=>({...p,price:e.target.value}))} placeholder="e.g. 795"
                  style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"8px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}/>
              </div>
              <div>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Initial Stock (L)</div>
                <input type="number" value={newP.initStock} onChange={e=>setNewP(p=>({...p,initStock:e.target.value}))} placeholder="e.g. 33000 (can be 0)"
                  style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"8px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}/>
              </div>
              <div>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"5px"}}>Low Stock Alert (L)</div>
                <input type="number" value={newP.threshold} onChange={e=>setNewP(p=>({...p,threshold:e.target.value}))} placeholder="e.g. 5000"
                  style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"8px 12px",fontFamily:F,fontSize:"13px",fontWeight:600,color:T.black,background:T.white,outline:"none"}}/>
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button disabled={!newP.name.trim()} onClick={handleAddProduct} style={{background:newP.name.trim()?T.black:T.gray200,color:newP.name.trim()?T.white:T.gray400,border:"none",padding:"11px 20px",fontSize:"12px",fontWeight:800,cursor:newP.name.trim()?"pointer":"not-allowed",fontFamily:F,minHeight:"42px"}}>Add Product</button>
            <button onClick={()=>setShowAdd(false)} style={{background:"none",color:T.gray400,border:`1px solid ${T.gray200}`,padding:"11px 16px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"42px"}}>Cancel</button>
          </div>
        </div>
      )}

      {/* Product cards */}
      {(depot.products||[]).length===0&&!showAdd?(
        <div style={{border:`1px dashed ${T.gray200}`,padding:"36px",textAlign:"center"}}>
          <div style={{fontSize:"14px",fontWeight:700,color:T.gray400,marginBottom:"8px"}}>No products added yet</div>
          <div style={{fontSize:"12px",color:T.gray400,marginBottom:"16px"}}>Add the products your depot handles to manage stock and set prices.</div>
          <button onClick={()=>setShowAdd(true)} style={{background:T.black,color:T.white,border:"none",padding:"10px 20px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"42px"}}>+ Add First Product</button>
        </div>
      ):(depot.products||[]).map(p=>(
        <ProductCard key={p.id} product={p} depot={depot}
          onAddStock={handleAddStock} onAdjustStock={handleAdjustStock}
          onUpdatePrice={handleUpdatePrice} onUpdateThreshold={handleUpdateThreshold}
          onRemove={handleRemove} isMobile={isMobile}/>
      ))}

      {/* Stock history */}
      {(depot.stockHistory||[]).length>0&&(
        <Card style={{marginTop:"8px"}}>
          <SectionHead title="Stock Movement Log" sub="Deliveries, dispatches & adjustments"/>
          {(depot.stockHistory||[]).slice(0,20).map((h,i)=>(
            <div key={h.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:i<Math.min((depot.stockHistory||[]).length,20)-1?`1px solid ${T.gray100}`:"none",gap:"12px",flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <div style={{width:"28px",height:"28px",background:h.qty>0?T.greenLight:h.type==="adjustment"?T.blueLight:T.redLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",flexShrink:0,fontWeight:700,color:h.qty>0?T.greenDark:h.type==="adjustment"?T.blue:T.red}}>
                  {h.qty>0?"↓":h.type==="adjustment"?"⇄":"↑"}
                </div>
                <div>
                  <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>
                    {h.type==="delivery"?"Stock Received":h.type==="adjustment"?"Manual Adjustment":"Dispatched"}
                    <span style={{background:T.gray100,color:T.gray600,fontSize:"10px",fontWeight:700,padding:"1px 5px",marginLeft:"6px"}}>{h.product}</span>
                  </div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"1px"}}>{h.ref} · {h.date}</div>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:"13px",fontWeight:800,color:h.qty>0?T.greenDark:h.type==="adjustment"?T.black:T.red}}>
                  {h.qty>0?"+":""}{Math.abs(h.qty)>=1000?`${(h.qty/1000).toFixed(0)}k`:h.qty} L
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   DEPOT DETAIL VIEW
════════════════════════════════════════════ */
function DepotDetailView({depot,onUpdateDepot,onViewOrder,isMobile}) {
  const [tab,setTab]=useState(depot.kyb==="pending"||depot.kyb==="submitted"?"kyb":"overview");
  const GEAR="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z";
  const lowStockCount=(depot.products||[]).filter(p=>p.threshold>0&&p.stock<p.threshold).length;
  const TABS=[
    {id:"overview",label:"Overview",icon:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"},
    {id:"inventory",label:"Inventory",icon:"M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",badge:lowStockCount||null,badgeColor:T.red},
    {id:"inbox",label:"Order Inbox",icon:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",badge:depot.kyb==="verified"?2:null},
    {id:"schedule",label:"Schedule",icon:"M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"},
    {id:"buyers",label:"Buyers",icon:"M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"},
    {id:"kyb",label:"KYB",icon:"M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",alert:depot.kyb!=="verified"},
    {id:"settings",label:"Settings",icon:GEAR},
  ];
  const isLocked=depot.kyb!=="verified"&&tab!=="kyb"&&tab!=="settings"&&tab!=="overview"&&tab!=="inventory";
  return (
    <div>
      <div style={{background:T.black,padding:isMobile?"16px":"20px 24px",marginBottom:"14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px",flexWrap:isMobile?"wrap":"nowrap"}}>
          <div>
            <div style={{fontSize:"9px",fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"4px"}}>Depot</div>
            <div style={{fontSize:isMobile?"18px":"22px",fontWeight:800,color:T.white}}>{depot.name}</div>
            <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{depot.location}{depot.license?` · ${depot.license}`:""}</div>
            {(depot.products||[]).length>0&&<div style={{fontSize:"10px",color:"#666",marginTop:"4px"}}>{(depot.products||[]).map(p=>p.name).join(" · ")}</div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:isMobile?"flex-start":"flex-end",gap:"6px"}}>
            <Badge status={depot.kyb==="verified"?"delivered":"pending"}/>
            {depot.kyb==="verified"&&depot.capacity>0&&<div style={{fontSize:"10px",color:T.gray400}}>{depot.capacity.toLocaleString()} L capacity</div>}
            {(depot.products||[]).length>0&&<div style={{fontSize:"10px",color:T.gray400}}>{(depot.products||[]).reduce((s,p)=>s+p.stock,0).toLocaleString()} L in stock</div>}
          </div>
        </div>
      </div>
      {depot.kyb==="pending"&&(
        <div style={{background:T.amberLight,border:`1px solid ${T.amber}`,padding:"11px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:"12px",fontWeight:800,color:"#8A5C00"}}>KYB Verification Pending</div>
            <div style={{fontSize:"11px",color:"#8A5C00",marginTop:"1px"}}>Submit documents to start receiving orders.</div>
          </div>
          <button onClick={()=>setTab("kyb")} style={{background:"#8A5C00",color:T.white,border:"none",padding:"8px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,flexShrink:0,minHeight:"36px"}}>Complete KYB →</button>
        </div>
      )}
      {depot.kyb==="submitted"&&(
        <div style={{background:T.blueLight,border:`1px solid ${T.blue}20`,padding:"11px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:"12px",fontWeight:800,color:T.blue}}>KYB Under Review</div>
            <div style={{fontSize:"11px",color:T.blue,marginTop:"1px",opacity:0.8}}>Documents submitted — Ventryl is reviewing your depot. Usually 1–3 business days.</div>
          </div>
          <button onClick={()=>setTab("kyb")} style={{background:T.blue,color:T.white,border:"none",padding:"8px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,flexShrink:0,minHeight:"36px"}}>View Status →</button>
        </div>
      )}
      {lowStockCount>0&&depot.kyb==="verified"&&(
        <div style={{background:T.redLight,border:`1px solid ${T.red}`,padding:"9px 16px",marginBottom:"14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <div style={{fontSize:"11px",fontWeight:700,color:T.red}}>{lowStockCount} product{lowStockCount!==1?"s":""} below low-stock threshold — reorder soon.</div>
          <button onClick={()=>setTab("inventory")} style={{background:T.red,color:T.white,border:"none",padding:"6px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,flexShrink:0,minHeight:"32px"}}>Manage →</button>
        </div>
      )}
      <div style={{display:"flex",borderBottom:`1px solid ${T.gray100}`,marginBottom:"20px",overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{display:"flex",alignItems:"center",gap:"5px",padding:"10px 14px",border:"none",background:"none",borderBottom:tab===t.id?`2px solid ${T.black}`:"2px solid transparent",color:tab===t.id?T.black:T.gray400,fontFamily:F,fontSize:"12px",fontWeight:tab===t.id?800:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
            <Icon d={t.icon} size={13}/>
            {isMobile?t.label.split(" ")[0]:t.label}
            {t.badge&&<span style={{background:t.badgeColor||T.red,color:T.white,fontSize:"9px",fontWeight:800,padding:"1px 4px",borderRadius:"8px",marginLeft:"2px"}}>{t.badge}</span>}
            {t.alert&&<span style={{width:"6px",height:"6px",background:T.amber,borderRadius:"50%",display:"inline-block",marginLeft:"3px"}}/>}
          </button>
        ))}
      </div>
      {isLocked?(
        <div style={{textAlign:"center",padding:"48px 20px"}}>
          <div style={{fontSize:"36px",marginBottom:"12px"}}>🔒</div>
          <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"6px"}}>Awaiting KYB Approval</div>
          <div style={{fontSize:"13px",color:T.gray400,marginBottom:"20px",maxWidth:"320px",margin:"0 auto 20px"}}>This section unlocks once your depot KYB is verified.</div>
          <button onClick={()=>setTab("kyb")} style={{background:T.black,color:T.white,border:"none",padding:"12px 24px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>Complete KYB →</button>
        </div>
      ):(
        <div>
          {tab==="overview"&&<DepotOverview depot={depot} onUpdateDepot={onUpdateDepot} onViewOrder={onViewOrder} isMobile={isMobile}/>}
          {tab==="inventory"&&<DepotInventory depot={depot} onUpdateDepot={onUpdateDepot} isMobile={isMobile}/>}
          {tab==="inbox"&&<DepotInbox depotId={depot?.id} isMobile={isMobile} onViewOrder={id=>onViewOrder&&onViewOrder(id)}/>}
          {tab==="schedule"&&<TruckSched isMobile={isMobile}/>}
          {tab==="buyers"&&<BuyerNetwork isMobile={isMobile}/>}
          {tab==="kyb"&&<DepotKYBView depot={depot} isMobile={isMobile}/>}
          {tab==="settings"&&<SettingsModule portalType="depot" depot={depot} onUpdateDepot={onUpdateDepot} isMobile={isMobile}/>}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   MARKET PULSE WIDGET
════════════════════════════════════════════ */
function MarketPulseWidget({onOrder}) {
  const {marketDepots,marketDepotsLoaded,loadMarketDepots}=useVentrylStore();
  useEffect(()=>{if(!marketDepotsLoaded)loadMarketDepots();},[]);
  const depotsSource=marketDepotsLoaded&&marketDepots.length?marketDepots:DEPOTS;
  const PRODUCTS=[
    {key:"pms",  name:"PMS",  fullName:"Premium Motor Spirit", unit:"/L", change:+2.1, color:T.green},
    {key:"ago",  name:"AGO",  fullName:"Automotive Gas Oil",   unit:"/L", change:-0.8, color:T.blue},
    {key:"dpk",  name:"DPK",  fullName:"Dual Purpose Kerosene",unit:"/L", change:+1.4, color:"#9B59B6"},
    {key:"lpg",  name:"LPG",  fullName:"Liquefied Petroleum Gas",unit:"/kg",change:-0.3,color:T.amber},
    {key:"atk",  name:"ATK",  fullName:"Aviation Turbine Kerosene",unit:"/L",change:+0.9,color:"#E67E22"},
    {key:"lpfo", name:"LPFO", fullName:"Low Pour Fuel Oil",    unit:"/L", change:-1.2, color:"#E74C3C"},
    {key:"hpfo", name:"HPFO", fullName:"High Pour Fuel Oil",   unit:"/L", change:+0.5, color:"#7F8C8D"},
  ];
  return (
    <Card style={{padding:0}}>
      {/* header */}
      <div style={{padding:"14px 16px 12px",borderBottom:`1px solid ${T.gray100}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>Market Prices</div>
          <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>7 product types · updated 2 min ago</div>
        </div>
        <span style={{fontSize:"9px",fontWeight:700,color:T.green,background:T.greenLight,padding:"3px 7px",letterSpacing:"0.04em"}}>● LIVE</span>
      </div>

      {/* per-product summary rows */}
      <div style={{padding:"0 16px"}}>
        {PRODUCTS.map((p,i)=>{
          const prices=depotsSource.map(d=>d[p.key]).filter(Boolean);
          if(!prices.length) return null;
          const best=Math.min(...prices);
          const high=Math.max(...prices);
          const bestDepot=depotsSource.find(d=>d[p.key]===best);
          const isLast=i===PRODUCTS.length-1||PRODUCTS.slice(i+1).every(pp=>!depotsSource.map(d=>d[pp.key]).filter(Boolean).length);
          return (
            <div key={p.key} style={{padding:"10px 0",borderBottom:isLast?"none":`1px solid ${T.gray100}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"3px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
                  <div style={{width:"7px",height:"7px",borderRadius:"50%",background:p.color,flexShrink:0}}/>
                  <div>
                    <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>{p.name}</span>
                    <span style={{fontSize:"9px",color:T.gray400,marginLeft:"5px"}}>{p.fullName}</span>
                  </div>
                  <span style={{fontSize:"9px",fontWeight:700,color:p.change>0?T.red:T.green,background:p.change>0?T.redLight:T.greenLight,padding:"1px 5px",flexShrink:0}}>
                    {p.change>0?"▲":"▼"}{Math.abs(p.change)}%
                  </span>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>₦{best.toLocaleString()}</span>
                  <span style={{fontSize:"9px",color:T.gray400,marginLeft:"2px"}}>{p.unit}</span>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingLeft:"14px"}}>
                <div style={{fontSize:"10px",color:T.gray400}}>Best: <span style={{color:T.greenDark,fontWeight:700}}>{bestDepot?.name}</span></div>
                <div style={{fontSize:"10px",color:T.gray400}}>Range: <span style={{color:T.gray600,fontWeight:600}}>₦{best.toLocaleString()}–₦{high.toLocaleString()}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{padding:"12px 16px 14px",borderTop:`1px solid ${T.gray100}`}}>
        <button onClick={onOrder} style={{width:"100%",background:T.black,color:T.white,border:"none",padding:"10px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"38px"}}>
          Place Order →
        </button>
      </div>
    </Card>
  );
}

/* ════════════════════════════════════════════
   DISPUTE MODAL
════════════════════════════════════════════ */
function DisputeModal({onClose,orderId,product,vol}) {
  const [step,setStep]=useState(1);
  const [reason,setReason]=useState("");
  const [details,setDetails]=useState("");
  const [ref]=useState(`DSP-${Date.now().toString().slice(-6)}`);

  const REASONS=[
    {id:"short_qty",label:"Short Quantity",desc:"Received less volume than ordered"},
    {id:"quality",label:"Product Quality Issue",desc:"Contaminated, off-spec or wrong grade"},
    {id:"not_delivered",label:"Delivery Not Completed",desc:"Trucks never arrived at destination"},
    {id:"wrong_product",label:"Wrong Product Delivered",desc:"Received different product than ordered"},
    {id:"delay",label:"Significant Delay",desc:"Delivery exceeded agreed SLA"},
    {id:"other",label:"Other Issue",desc:"Something else went wrong"},
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
      <div style={{background:T.white,maxWidth:"480px",width:"100%",maxHeight:"90vh",overflowY:"auto",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{padding:"20px 24px",borderBottom:`1px solid ${T.gray100}`,display:"flex",alignItems:"center",gap:"12px",position:"sticky",top:0,background:T.white,zIndex:1}}>
          {step>1&&step<4&&<button onClick={()=>setStep(s=>s-1)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"18px",lineHeight:1,color:T.gray400,padding:0}}>←</button>}
          <div style={{flex:1}}>
            <div style={{fontSize:"14px",fontWeight:800,color:T.black}}>
              {step===4?"Dispute Submitted":"Raise a Dispute"}
            </div>
            <div style={{fontSize:"11px",color:T.gray400,marginTop:"1px"}}>{orderId} · {product} · {(vol/1000).toFixed(0)}k L</div>
          </div>
          {step===4&&<button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:"20px",color:T.gray400,padding:0,lineHeight:1}}>×</button>}
          {/* Step indicator */}
          {step<4&&<div style={{display:"flex",gap:"4px"}}>
            {[1,2,3].map(s=><div key={s} style={{width:"6px",height:"6px",borderRadius:"50%",background:step>=s?T.black:T.gray200}}/>)}
          </div>}
        </div>

        <div style={{padding:"20px 24px",flex:1}}>
          {/* Step 1: Choose reason */}
          {step===1&&(
            <div>
              <div style={{fontSize:"12px",color:T.gray600,marginBottom:"16px"}}>Select the reason that best describes your issue:</div>
              {REASONS.map(r=>(
                <div key={r.id} onClick={()=>setReason(r.id)} style={{display:"flex",alignItems:"flex-start",gap:"12px",padding:"12px 14px",border:`2px solid ${reason===r.id?T.black:T.gray100}`,background:reason===r.id?T.black:T.white,cursor:"pointer",marginBottom:"8px",transition:"all 0.15s"}}>
                  <div style={{width:"18px",height:"18px",border:`2px solid ${reason===r.id?T.white:T.gray400}`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"1px"}}>
                    {reason===r.id&&<div style={{width:"8px",height:"8px",borderRadius:"50%",background:T.white}}/>}
                  </div>
                  <div>
                    <div style={{fontSize:"13px",fontWeight:800,color:reason===r.id?T.white:T.black}}>{r.label}</div>
                    <div style={{fontSize:"11px",color:reason===r.id?"#aaa":T.gray400,marginTop:"1px"}}>{r.desc}</div>
                  </div>
                </div>
              ))}
              <button disabled={!reason} onClick={()=>setStep(2)} style={{marginTop:"8px",background:reason?T.black:T.gray200,color:reason?T.white:T.gray400,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:reason?"pointer":"not-allowed",fontFamily:F,width:"100%",minHeight:"44px"}}>Continue →</button>
            </div>
          )}

          {/* Step 2: Details */}
          {step===2&&(
            <div>
              <div style={{background:T.gray50,padding:"12px 14px",marginBottom:"16px"}}>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",marginBottom:"2px"}}>Issue</div>
                <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{REASONS.find(r=>r.id===reason)?.label}</div>
              </div>
              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Describe what happened <span style={{color:T.red}}>*</span></div>
              <textarea value={details} onChange={e=>setDetails(e.target.value)}
                placeholder="Provide specific details: quantities, times, truck plates, what the driver said, photos taken, etc."
                style={{width:"100%",minHeight:"120px",border:`1px solid ${details.trim().length>20?T.green:T.gray200}`,padding:"12px 14px",fontFamily:F,fontSize:"13px",color:T.black,outline:"none",resize:"vertical",marginBottom:"6px"}}/>
              <div style={{fontSize:"10px",color:T.gray400,marginBottom:"16px"}}>{details.length}/500 · Minimum 20 characters</div>

              <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Evidence (optional)</div>
              <div style={{border:`1px dashed ${T.gray200}`,padding:"20px",textAlign:"center",marginBottom:"20px",cursor:"pointer",background:T.gray50}}>
                <div style={{fontSize:"24px",marginBottom:"6px"}}>📎</div>
                <div style={{fontSize:"12px",fontWeight:700,color:T.gray600}}>Attach photos, waybills, or documents</div>
                <div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>JPG, PNG, PDF · Max 10MB each</div>
              </div>

              <button disabled={details.trim().length<20} onClick={()=>setStep(3)} style={{background:details.trim().length>=20?T.black:T.gray200,color:details.trim().length>=20?T.white:T.gray400,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:details.trim().length>=20?"pointer":"not-allowed",fontFamily:F,width:"100%",minHeight:"44px"}}>Review Dispute →</button>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step===3&&(
            <div>
              <div style={{background:T.amberLight,border:`1px solid ${T.amber}`,padding:"12px 14px",marginBottom:"16px"}}>
                <div style={{fontSize:"12px",fontWeight:700,color:"#8A5C00"}}>⚠ Once submitted, this dispute will be reviewed by Ventryl within 24–48 hours. The depot will be notified.</div>
              </div>
              <div style={{border:`1px solid ${T.gray100}`,marginBottom:"16px"}}>
                {[
                  ["Order",orderId],
                  ["Product",`${product} · ${(vol/1000).toFixed(0)}k L`],
                  ["Issue",REASONS.find(r=>r.id===reason)?.label||reason],
                  ["Details",details.slice(0,120)+(details.length>120?"…":"")],
                ].map(([k,v])=>(
                  <div key={k} style={{display:"flex",gap:"16px",padding:"10px 14px",borderBottom:`1px solid ${T.gray100}`,fontSize:"12px"}}>
                    <span style={{color:T.gray400,fontWeight:600,width:"70px",flexShrink:0}}>{k}</span>
                    <span style={{color:T.black,fontWeight:700,flex:1}}>{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={()=>setStep(4)} style={{background:T.red,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,width:"100%",minHeight:"44px",marginBottom:"8px"}}>Submit Dispute</button>
              <button onClick={onClose} style={{background:"none",border:`1px solid ${T.gray200}`,color:T.gray600,padding:"10px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:F,width:"100%",minHeight:"40px"}}>Cancel</button>
            </div>
          )}

          {/* Step 4: Submitted */}
          {step===4&&(
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{width:"56px",height:"56px",background:T.amberLight,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:"24px"}}>⚠</div>
              <div style={{fontSize:"18px",fontWeight:800,color:T.black,marginBottom:"8px"}}>Dispute Filed</div>
              <div style={{fontSize:"12px",color:T.gray400,lineHeight:1.6,marginBottom:"20px"}}>Reference: <strong style={{color:T.black}}>{ref}</strong><br/>Our team will review this dispute within 24–48 hours. Both parties will be notified via email and in-app.</div>
              <div style={{border:`1px solid ${T.gray100}`,padding:"14px",marginBottom:"20px",textAlign:"left"}}>
                {[["Status","Under Review"],["Filed","Just now"],["Ref",ref],["Response ETA","24–48 hours"]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.gray100}`,fontSize:"12px"}}>
                    <span style={{color:T.gray400,fontWeight:600}}>{k}</span>
                    <span style={{color:T.black,fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={onClose} style={{background:T.black,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,width:"100%",minHeight:"44px"}}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   BUYER ORDER DETAIL — Customer tracking view
════════════════════════════════════════════ */
function BuyerOrderDetail({orderId,onBack,isMobile}) {
  const _placed = _placedOrdersStore.find(o=>o.id===orderId);
  const {buyerOrders,orderDetails,loadOrderDetail}=useVentrylStore();
  // Load detail from DB if not already in session or cache
  useEffect(()=>{if(!_placed)loadOrderDetail(orderId);},[orderId]);
  const storeOrder=buyerOrders.find(o=>o.id===orderId);
  const order = _placed||storeOrder||ORDERS.find(o=>o.id===orderId)||INCOMING.find(o=>o.id===orderId);
  const meta  = _placed?.meta||orderDetails[orderId]||ORDER_META[orderId]||{};

  // local live-tracking state (synced from depot stores so changes persist across navigation)
  const [liveStatus,setLiveStatus]=useState(()=>_orderStatusStore[orderId]||order?.status||"pending");
  const [liveTrucks,setLiveTrucks]=useState(()=>_orderTruckListStore[orderId]||(meta.trucks_detail||[]).map(t=>({...t})));
  const [deliveryConfirmed,setDeliveryConfirmed]=useState(()=>_buyerConfirmedStore[orderId]||false);
  const [showConfirmModal,setShowConfirmModal]=useState(false);
  const [showDispute,setShowDispute]=useState(false);
  const [activeTab,setActiveTab]=useState("tracking");  // tracking | details | payment

  // Delivery cost negotiation state
  const [quoteRounds,setQuoteRounds]=useState(()=>(_deliveryQuoteStore[orderId]||{rounds:[]}).rounds);
  const [quoteStatus,setQuoteStatus]=useState(()=>(_deliveryQuoteStore[orderId]||{status:"none"}).status);
  const [counterInput,setCounterInput]=useState("");
  const [showCounterForm,setShowCounterForm]=useState(false);

  // ── Realtime: update live state when Supabase pushes changes ──────
  useOrderRealtime(orderId,(payload)=>{
    const {table,new:n}=payload;
    if(table==="orders"&&n?.status) setLiveStatus(n.status);
    if(table==="order_trucks"&&n){
      setLiveTrucks(prev=>{
        const idx=prev.findIndex(t=>t.id===n.id);
        if(idx>=0) return prev.map((t,i)=>i===idx?{...t,...n}:t);
        return [...prev,n];
      });
    }
    if(table==="delivery_negotiations"&&n){
      if(n.status) setQuoteStatus(n.status);
    }
  });

  const approveDeliveryQuote=()=>{
    const newStatus="agreed";
    _deliveryQuoteStore[orderId]={rounds:quoteRounds,status:newStatus};
    setQuoteStatus(newStatus);
    setShowCounterForm(false);
  };

  const sendCounterOffer=(amount)=>{
    const now=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    const round={from:"buyer",amount:parseInt(amount),time:now};
    const newRounds=[...quoteRounds,round];
    const newStatus="depot_pending";
    _deliveryQuoteStore[orderId]={rounds:newRounds,status:newStatus};
    setQuoteRounds(newRounds);
    setQuoteStatus(newStatus);
    setCounterInput("");
    setShowCounterForm(false);
  };

  if(!order) return (
    <div style={{padding:"40px",textAlign:"center"}}>
      <div style={{fontSize:"14px",fontWeight:700,color:T.gray400}}>Order not found.</div>
      <button onClick={onBack} style={{marginTop:"16px",background:T.black,color:T.white,border:"none",padding:"9px 18px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F}}>← Back</button>
    </div>
  );

  const finials   = meta.financials||{};
  const timeline  = meta.timeline||[];
  const buyerInfo = meta.buyer||{};
  const depotInfo = meta.depot||{};
  const delivery  = meta.delivery||null;
  const isDelivery= !delivery||delivery.mode==="delivery";
  const fmtMoney  = n=>n>=1e6?`₦${(n/1e6).toFixed(2)}M`:`₦${n?.toLocaleString()||"0"}`;
  const isMulti   = Array.isArray(meta.products)&&meta.products.length>1;
  const vol       = meta.vol||order.vol||0;
  const product   = isMulti ? meta.products.map(p=>p.name).join(" + ") : (meta.product||order.product);
  const truckCount= meta.trucks||order.trucks||0;

  const STATUS_STEPS=["pending","confirmed","loading","in_transit","delivered"];
  const STEP_LABELS =["Placed","Confirmed","Loading","In Transit","Delivered"];
  const currentStep =Math.max(0,STATUS_STEPS.indexOf(liveStatus));

  // Status-specific hero config
  const HERO={
    pending:  {bg:T.gray800,    accent:T.gray400, icon:"🕐", title:"Waiting for Depot",      msg:"Your order has been submitted. The depot has up to 2 hours to confirm.",      cta:null},
    confirmed:{bg:"#1A3A0A",    accent:T.green,   icon:"✅", title:"Order Confirmed",        msg:`${depotInfo.name||"The depot"} confirmed your order. Loading preparations are underway.`,cta:null},
    loading:  {bg:"#0A1F3A",    accent:T.blue,    icon:"⚙️", title:"Loading in Progress",    msg:`Your products are being loaded at ${meta.bay||"the depot"}. Trucks depart soon.`,cta:null},
    in_transit:{bg:"#0A1F3A",   accent:T.blue,    icon:"🚛", title:"On the Way",             msg:`${truckCount} truck${truckCount!==1?"s":""} are en route to your location. Track progress below.`,cta:null},
    delivered:{bg:"#0D2B0D",    accent:T.green,   icon:"📦", title:"Arrived — Confirm Receipt",msg:`${truckCount} truck${truckCount!==1?"s":""} have arrived. Please confirm receipt to complete the order.`,cta:"confirm"},
  };
  const hero = HERO[liveStatus]||HERO.pending;
  const allDelivered = liveTrucks.length>0&&liveTrucks.every(t=>t.status==="delivered");

  return (
    <div>
      {/* Modals */}
      {showDispute&&<DisputeModal onClose={()=>setShowDispute(false)} orderId={orderId} product={product} vol={vol}/>}
      {showConfirmModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{background:T.white,maxWidth:"400px",width:"100%",padding:"28px"}}>
            <div style={{fontSize:"18px",fontWeight:800,color:T.black,marginBottom:"10px"}}>Confirm Receipt?</div>
            <div style={{fontSize:"13px",color:T.gray600,lineHeight:1.6,marginBottom:"10px"}}>
              You are confirming receipt of <strong>{(vol/1000).toFixed(0)}k litres</strong> of <strong>{product}</strong> from <strong>{depotInfo.name||order.depot}</strong>.
            {isMulti&&(
              <div style={{marginTop:"8px",display:"flex",flexDirection:"column",gap:"3px"}}>
                {meta.products.map(p=><div key={p.name} style={{fontSize:"11px",color:T.gray600}}>· {p.name}: {(p.vol/1000).toFixed(0)}k L</div>)}
              </div>
            )}
            </div>
            <div style={{background:T.amberLight,border:`1px solid ${T.amber}`,padding:"10px 14px",marginBottom:"20px",fontSize:"11px",color:"#8A5C00",fontWeight:600}}>
              ⚠ Only confirm if you have physically received and checked the delivery. Payment will be released to the depot.
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={()=>{_buyerConfirmedStore[orderId]=true;setDeliveryConfirmed(true);setShowConfirmModal(false);}} style={{flex:1,background:T.green,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>Yes, Confirm</button>
              <button onClick={()=>setShowConfirmModal(false)} style={{flex:1,background:"none",color:T.black,border:`1px solid ${T.gray200}`,padding:"12px",fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Back + header */}
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px",flexWrap:"wrap"}}>
        <button onClick={onBack} style={{background:"none",border:`1px solid ${T.gray200}`,color:T.black,padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>← Back</button>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
            <span style={{fontSize:isMobile?"16px":"20px",fontWeight:800,color:T.black}}>{order.id}</span>
            <Badge status={liveStatus}/>
          </div>
          <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{depotInfo.name||order.depot} · {product} · {meta.placed||order.placed}</div>
        </div>
        <div style={{display:"flex",gap:"8px",flexShrink:0,flexWrap:"wrap"}}>
          {/* Raise dispute — only before delivery confirmed */}
          {liveStatus!=="delivered"||(deliveryConfirmed===false)?(
            liveStatus!=="pending"&&liveStatus!=="delivered"&&(
              <button onClick={()=>setShowDispute(true)}
                style={{background:"none",border:`1px solid ${T.red}`,color:T.red,padding:"7px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>
                ⚠ Dispute
              </button>
            )
          ):null}

          {/* Confirm receipt — delivered but not yet confirmed */}
          {liveStatus==="delivered"&&!deliveryConfirmed&&(
            <button onClick={()=>setShowConfirmModal(true)}
              style={{background:T.green,color:T.white,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px",whiteSpace:"nowrap"}}>
              ✓ Confirm Receipt
            </button>
          )}

          {/* Invoice — only after confirmed */}
          {deliveryConfirmed&&(
            <button
              onClick={()=>printInvoice({
                orderId,
                product,
                vol,
                pricePerLitre:order?.pricePerLitre||meta?.price_per_litre||0,
                buyer:order?.buyer||"Chukwuma Fuels Ltd",
                buyerAddr:"Lagos, Nigeria",
                depot:order?.depot||meta?.depot||"Depot",
                depotAddr:"Lagos, Nigeria",
                depotLicense:meta?.license||"",
                date:new Date().toLocaleDateString('en-NG',{day:'2-digit',month:'long',year:'numeric'}),
                vat:true,
              })}
              style={{background:T.black,color:T.white,border:"none",padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>
              ⬇ Invoice
            </button>
          )}
        </div>
      </div>

      {/* ── STATUS HERO BANNER ── */}
      <div style={{background:hero.bg,padding:isMobile?"16px":"20px 24px",marginBottom:"16px",position:"relative",overflow:"hidden"}}>
        {/* subtle animated ring for in_transit */}
        {liveStatus==="in_transit"&&(
          <div style={{position:"absolute",right:"-30px",top:"-30px",width:"120px",height:"120px",borderRadius:"50%",border:`2px solid ${T.blue}`,opacity:0.15,animation:"pulse 2s infinite"}}/>
        )}
        <div style={{display:"flex",alignItems:"center",gap:"16px",flexWrap:"wrap"}}>
          <div style={{fontSize:isMobile?"28px":"36px",lineHeight:1,flexShrink:0}}>{hero.icon}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:isMobile?"16px":"20px",fontWeight:800,color:T.white,marginBottom:"4px"}}>{hero.title}</div>
            <div style={{fontSize:"12px",color:"#aaa",lineHeight:1.5}}>{hero.msg}</div>
            {liveStatus==="in_transit"&&meta.trucks_detail?.[0]?.eta&&(
              <div style={{marginTop:"8px",display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
                <span style={{background:T.blue,color:T.white,fontSize:"11px",fontWeight:800,padding:"3px 10px"}}>ETA {meta.trucks_detail[0].eta}</span>
                <span style={{fontSize:"10px",color:"#888"}}>Lead truck · {meta.trucks_detail[0].plate}</span>
              </div>
            )}
          </div>
          {/* Primary CTA */}
          {liveStatus==="delivered"&&!deliveryConfirmed&&(
            <button onClick={()=>setShowConfirmModal(true)} style={{background:T.green,color:T.white,border:"none",padding:"12px 20px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"48px",whiteSpace:"nowrap",flexShrink:0}}>
              Confirm Receipt ✓
            </button>
          )}
          {liveStatus==="delivered"&&deliveryConfirmed&&(
            <div style={{background:T.green,color:T.white,padding:"10px 16px",fontSize:"12px",fontWeight:800}}>✓ Receipt Confirmed</div>
          )}
          {liveStatus==="pending"&&(
            <button onClick={()=>setShowDispute(true)} style={{background:"transparent",color:"#aaa",border:"1px solid #333",padding:"9px 14px",fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,minHeight:"40px",flexShrink:0}}>
              Cancel Order
            </button>
          )}
        </div>

        {/* Progress bar inside hero for in_transit */}
        {liveStatus==="in_transit"&&liveTrucks.length>0&&(
          <div style={{marginTop:"14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
              <span style={{fontSize:"10px",color:"#888",fontWeight:600}}>Overall delivery progress</span>
              <span style={{fontSize:"10px",color:"#aaa",fontWeight:700}}>
                {liveTrucks.filter(t=>t.status==="delivered").length}/{liveTrucks.length} trucks arrived
              </span>
            </div>
            <div style={{height:"4px",background:"#1A1A2E",borderRadius:"2px",overflow:"hidden"}}>
              <div style={{height:"100%",background:T.blue,borderRadius:"2px",transition:"width 0.5s",
                width:`${Math.round(liveTrucks.reduce((s,t)=>s+(t.progress||0),0)/Math.max(liveTrucks.length,1))}%`}}/>
            </div>
          </div>
        )}
      </div>

      {/* ── 5-STEP STEPPER ── */}
      <Card style={{marginBottom:"16px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",position:"relative"}}>
          <div style={{position:"absolute",top:"13px",left:"13px",right:"13px",height:"2px",background:T.gray100,zIndex:0}}/>
          <div style={{position:"absolute",top:"13px",left:"13px",height:"2px",
            width:`${Math.max(0,(currentStep/(STATUS_STEPS.length-1))*100)}%`,
            background:T.green,zIndex:1,transition:"width 0.6s ease"}}/>
          {STATUS_STEPS.map((s,i)=>{
            const done=i<currentStep;
            const active=i===currentStep;
            return (
              <div key={s} style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1,zIndex:2,position:"relative"}}>
                <div style={{width:"26px",height:"26px",borderRadius:"50%",
                  background:done?T.green:active?T.black:T.white,
                  border:`2px solid ${done?T.green:active?T.black:T.gray200}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:"10px",fontWeight:800,color:done||active?T.white:T.gray400,
                  transition:"all 0.4s",
                  boxShadow:active?"0 0 0 4px rgba(6,193,103,0.18)":"none"}}>
                  {done?"✓":i+1}
                </div>
                <div style={{marginTop:"6px",fontSize:"9px",fontWeight:700,
                  color:done||active?T.black:T.gray400,
                  textTransform:"uppercase",letterSpacing:"0.04em",
                  textAlign:"center",whiteSpace:"nowrap"}}>
                  {STEP_LABELS[i]}
                </div>
                {active&&(
                  <div style={{width:"5px",height:"5px",borderRadius:"50%",background:T.green,
                    marginTop:"3px",animation:"pulse 1.4s infinite"}}/>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── TAB BAR ── */}
      <div style={{display:"flex",borderBottom:`2px solid ${T.gray100}`,marginBottom:"16px"}}>
        {[["tracking","Tracking"],["details","Order Details"],["payment","Payment"]].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)}
            style={{padding:"9px 16px",background:"none",border:"none",cursor:"pointer",fontFamily:F,
              fontSize:"12px",fontWeight:activeTab===id?800:600,
              color:activeTab===id?T.black:T.gray400,
              borderBottom:`2px solid ${activeTab===id?T.black:"transparent"}`,
              marginBottom:"-2px",transition:"all 0.15s"}}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ TAB: TRACKING ══ */}
      {activeTab==="tracking"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.4fr 1fr",gap:"14px",alignItems:"start"}}>

          {/* LEFT: Status context + trucks */}
          <div>
            {/* Status context card */}
            <Card style={{marginBottom:"14px"}}>
              <SectionHead title="What's happening"/>
              <div style={{display:"flex",flexDirection:"column",gap:"0"}}>
                {[
                  {s:"pending",   icon:"🕐", label:"Order Placed",     done:currentStep>=0, active:currentStep===0,
                   detail:"Your order is with the depot. Confirmation expected within 2 hours."},
                  {s:"confirmed", icon:"✅", label:"Depot Confirmed",   done:currentStep>=1, active:currentStep===1,
                   detail:`${depotInfo.name||"Depot"} accepted the order. Bay ${meta.bay||"assigned"} · Loading ref: ${meta.loadingRef||"TBA"}.`},
                  {s:"loading",   icon:"⚙️", label:"Loading Products",  done:currentStep>=2, active:currentStep===2,
                   detail:`Products are being loaded at ${meta.bay||"loading bay"}. Trucks depart once complete.`},
                  {s:"in_transit",icon:"🚛", label:"En Route",          done:currentStep>=3, active:currentStep===3,
                   detail:`${truckCount} truck${truckCount!==1?"s":""} dispatched. Lead truck ETA: ${meta.trucks_detail?.[0]?.eta||"—"}.`},
                  {s:"delivered", icon:"📦", label:"Delivered",         done:currentStep>=4, active:currentStep===4,
                   detail:deliveryConfirmed?"Receipt confirmed. Payment has been processed.":"Trucks have arrived. Please inspect and confirm receipt."},
                ].map((step,i,arr)=>(
                  <div key={step.s} style={{display:"flex",gap:"12px",paddingBottom:i<arr.length-1?"16px":"0",position:"relative"}}>
                    {i<arr.length-1&&(
                      <div style={{position:"absolute",left:"15px",top:"32px",bottom:0,width:"2px",
                        background:step.done?T.green:T.gray100,transition:"background 0.4s"}}/>
                    )}
                    <div style={{width:"30px",height:"30px",borderRadius:"50%",flexShrink:0,
                      background:step.done?(step.active?T.black:T.green):T.gray100,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",
                      border:`2px solid ${step.done?T.green:T.gray200}`,
                      boxShadow:step.active?"0 0 0 4px rgba(6,193,103,0.15)":"none",
                      transition:"all 0.4s",zIndex:1}}>
                      {step.done&&!step.active?"✓":step.icon}
                    </div>
                    <div style={{flex:1,paddingTop:"4px"}}>
                      <div style={{fontSize:"12px",fontWeight:800,
                        color:step.done?T.black:T.gray400,marginBottom:"2px"}}>{step.label}</div>
                      {(step.done||step.active)&&(
                        <div style={{fontSize:"11px",color:T.gray600,lineHeight:1.5}}>{step.detail}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Truck tracking */}
            {liveTrucks.length>0&&(liveStatus==="loading"||liveStatus==="in_transit"||liveStatus==="delivered")&&(
              <Card style={{marginBottom:"14px"}}>
                <SectionHead title="Truck Tracking" sub={`${liveTrucks.length} truck${liveTrucks.length!==1?"s":`s`} · ${(vol/1000).toFixed(0)}k L total`}/>
                {liveTrucks.map((t,i)=>{
                  const tStatus=t.status;
                  const isDelivered=tStatus==="delivered";
                  const isMoving=tStatus==="in_transit";
                  const isLoading=liveStatus==="loading";
                  return (
                    <div key={t.id} style={{paddingTop:i>0?"14px":"0",marginTop:i>0?"14px":"0",
                      borderTop:i>0?`1px solid ${T.gray100}`:"none"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"8px",flexWrap:isMobile?"wrap":"nowrap"}}>
                        <div style={{display:"flex",alignItems:"flex-start",gap:"10px",flex:1}}>
                          <div style={{width:"36px",height:"36px",flexShrink:0,
                            background:isDelivered?T.greenLight:isMoving?T.blueLight:T.gray100,
                            display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px"}}>
                            🚛
                          </div>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"2px",flexWrap:"wrap"}}>
                              <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>Truck {i+1}</span>
                              <Badge status={isDelivered?"delivered":isLoading?"loading":tStatus}/>
                            </div>
                            <div style={{fontSize:"11px",color:T.gray600,marginBottom:"1px"}}>
                              {t.driver==="TBD"?"Driver: TBA":t.driver}
                            </div>
                            <div style={{fontSize:"10px",color:T.gray400}}>
                              {t.plate==="TBD"?"Plate: TBA":t.plate} · {(t.vol/1000).toFixed(0)}k L
                            </div>
                          </div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          {isDelivered?(
                            <div>
                              <div style={{fontSize:"11px",fontWeight:800,color:T.greenDark}}>✓ Arrived</div>
                              {t.arrivalTime&&<div style={{fontSize:"10px",color:T.gray400}}>{t.arrivalTime}</div>}
                            </div>
                          ):isMoving?(
                            <div>
                              <div style={{fontSize:"11px",fontWeight:800,color:T.blue}}>En Route</div>
                              <div style={{fontSize:"10px",color:T.gray400}}>ETA {t.eta}</div>
                            </div>
                          ):(
                            <div style={{fontSize:"10px",color:T.gray400}}>Departed {t.departure!=="TBD"?t.departure:"TBA"}</div>
                          )}
                        </div>
                      </div>
                      {(isMoving||isDelivered)&&(
                        <div style={{marginTop:"10px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                            <span style={{fontSize:"10px",color:T.gray400}}>
                              {isDelivered?"Delivered":"En route"}
                              {t.departure!=="TBD"&&!isDelivered?` · Departed ${t.departure}`:""}
                            </span>
                            <span style={{fontSize:"10px",fontWeight:800,color:isDelivered?T.greenDark:T.blue}}>{t.progress}%</span>
                          </div>
                          <div style={{height:"6px",background:T.gray100,borderRadius:"3px",overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${t.progress}%`,
                              background:isDelivered?T.green:T.blue,
                              borderRadius:"3px",transition:"width 0.6s ease"}}/>
                          </div>
                          {isMoving&&(
                            <div style={{display:"flex",justifyContent:"space-between",marginTop:"3px"}}>
                              <span style={{fontSize:"9px",color:T.gray400}}>Departed</span>
                              <span style={{fontSize:"9px",color:T.gray400}}>ETA {t.eta}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>
            )}

            {/* Delivery confirmation card */}
            {liveStatus==="delivered"&&!deliveryConfirmed&&(
              <div style={{border:`2px solid ${T.green}`,background:T.greenLight,padding:"18px 20px",marginBottom:"14px"}}>
                <div style={{fontSize:"14px",fontWeight:800,color:T.greenDark,marginBottom:"6px"}}>📦 Delivery Complete — Action Required</div>
                <div style={{fontSize:"12px",color:T.greenDark,lineHeight:1.6,marginBottom:"14px"}}>
                  All trucks have arrived. Please inspect the delivery and confirm receipt. This releases payment to the depot.
                </div>
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                  <button onClick={()=>setShowConfirmModal(true)}
                    style={{background:T.green,color:T.white,border:"none",padding:"12px 24px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
                    Confirm Receipt ✓
                  </button>
                  <button onClick={()=>setShowDispute(true)}
                    style={{background:"none",color:T.red,border:`2px solid ${T.red}`,padding:"12px 18px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
                    Issue with Delivery
                  </button>
                </div>
              </div>
            )}
            {liveStatus==="delivered"&&deliveryConfirmed&&(
              <div style={{background:T.greenLight,border:`1px solid ${T.green}`,padding:"14px 18px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"12px"}}>
                <span style={{fontSize:"22px"}}>✅</span>
                <div>
                  <div style={{fontSize:"13px",fontWeight:800,color:T.greenDark}}>Receipt Confirmed</div>
                  <div style={{fontSize:"11px",color:T.greenDark,marginTop:"2px"}}>
                    Payment of {fmtMoney((finials.productValue||0)+(quoteStatus==="agreed"?quoteRounds[quoteRounds.length-1]?.amount||0:0))} released to {depotInfo.name||"the depot"}.
                  </div>
                  {quoteStatus==="agreed"&&(
                    <div style={{fontSize:"10px",color:T.greenDark,marginTop:"2px",fontWeight:600,opacity:0.8}}>
                      Includes ₦{(quoteRounds[quoteRounds.length-1]?.amount||0).toLocaleString()} delivery cost
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Depot info + timeline + actions */}
          <div>
            {/* Depot card */}
            <Card style={{marginBottom:"14px"}}>
              <SectionHead title="Depot"/>
              <div style={{display:"flex",alignItems:"flex-start",gap:"12px",marginBottom:"12px"}}>
                <div style={{width:"40px",height:"40px",background:T.black,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",fontWeight:800,color:T.white,flexShrink:0}}>
                  {(depotInfo.name||order.depot||"D")[0]}
                </div>
                <div>
                  <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{depotInfo.name||order.depot}</div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"1px"}}>{depotInfo.location||"—"}</div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"1px"}}>{depotInfo.contact||"—"}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                {[["Loading Bay",meta.bay||"TBA"],["Loading Ref",meta.loadingRef||"TBA"],["Dispatch",meta.dispatchDate?meta.dispatchDate.split(" · ")[1]||"—":"TBA"],["ETA",meta.trucks_detail?.[0]?.eta||"TBA"]].map(([l,v])=>(
                  <div key={l}>
                    <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"2px"}}>{l}</div>
                    <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{v}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Delivery location strip */}
            <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
              <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.gray100}`,display:"flex",alignItems:"center",gap:"8px",background:T.gray50}}>
                <span style={{fontSize:"14px"}}>{isDelivery?"🚛":"🏭"}</span>
                <div style={{fontSize:"11px",fontWeight:800,color:T.black}}>{isDelivery?"Delivery Location":"Self Pick-up"}</div>
                <span style={{marginLeft:"auto",fontSize:"9px",fontWeight:800,padding:"2px 7px",background:isDelivery?T.blueLight:T.amberLight,color:isDelivery?T.blue:"#8A5C00"}}>{isDelivery?"DELIVERY":"PICK-UP"}</span>
              </div>
              {isDelivery&&delivery?.state?(
                <div style={{padding:"12px 14px"}}>
                  <div style={{fontSize:"13px",fontWeight:800,color:T.black,marginBottom:"3px"}}>{delivery.lga}, {delivery.state}</div>
                  <div style={{fontSize:"11px",color:T.gray600,lineHeight:1.4}}>{delivery.address}</div>
                </div>
              ):(
                <div style={{padding:"12px 14px"}}>
                  <div style={{fontSize:"12px",fontWeight:700,color:T.black,marginBottom:"2px"}}>{depotInfo.name||order.depot}</div>
                  <div style={{fontSize:"11px",color:T.gray400}}>{depotInfo.location||"—"} · You collect</div>
                </div>
              )}
            </Card>

            {/* Delivery cost negotiation card */}
            {isDelivery&&(liveStatus==="confirmed"||quoteStatus!=="none")&&(
              <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
                <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.gray100}`,display:"flex",alignItems:"center",gap:"8px",
                  background:quoteStatus==="agreed"?T.greenLight:quoteStatus==="buyer_pending"?"#12122A":quoteStatus==="depot_pending"?T.amberLight:T.gray50}}>
                  <span style={{fontSize:"14px"}}>💰</span>
                  <div style={{fontSize:"11px",fontWeight:800,color:quoteStatus==="agreed"?T.greenDark:quoteStatus==="buyer_pending"?T.white:T.black}}>Delivery Cost</div>
                  <span style={{marginLeft:"auto",fontSize:"9px",fontWeight:800,padding:"2px 7px",flexShrink:0,
                    background:quoteStatus==="agreed"?T.greenDark:quoteStatus==="buyer_pending"?T.green:quoteStatus==="depot_pending"?"#8A5C00":T.gray400,
                    color:T.white}}>
                    {quoteStatus==="agreed"?"AGREED":quoteStatus==="buyer_pending"?"REVIEW NOW":quoteStatus==="depot_pending"?"SENT":"PENDING"}
                  </span>
                </div>

                {quoteStatus==="none"&&(
                  <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:"10px"}}>
                    <span style={{fontSize:"18px"}}>⏳</span>
                    <div>
                      <div style={{fontSize:"11px",fontWeight:700,color:T.black}}>Awaiting delivery cost quote</div>
                      <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>{depotInfo.name||order.depot} will send a quote shortly.</div>
                    </div>
                  </div>
                )}

                {quoteStatus==="buyer_pending"&&(
                  <div style={{padding:"14px"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>
                      {depotInfo.name||order.depot}'s Quote
                    </div>
                    <div style={{fontSize:"26px",fontWeight:800,color:T.black,marginBottom:"4px"}}>
                      ₦{(quoteRounds[quoteRounds.length-1]?.amount||0).toLocaleString()}
                    </div>
                    <div style={{fontSize:"10px",color:T.gray400,fontWeight:600,marginBottom:"14px"}}>
                      Delivery to {delivery?.lga}, {delivery?.state} · Quoted {quoteRounds[quoteRounds.length-1]?.time||""}
                    </div>
                    <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:showCounterForm?"12px":"0"}}>
                      <button onClick={approveDeliveryQuote}
                        style={{flex:1,background:T.green,color:T.white,border:"none",padding:"11px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>
                        Approve ✓
                      </button>
                      <button onClick={()=>setShowCounterForm(!showCounterForm)}
                        style={{flex:1,background:"none",color:T.black,border:`2px solid ${T.black}`,padding:"11px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>
                        {showCounterForm?"Cancel":"Counter-offer"}
                      </button>
                    </div>
                    {showCounterForm&&(
                      <div>
                        <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>
                          Your Counter-offer (₦)
                        </div>
                        <div style={{display:"flex",gap:"8px"}}>
                          <div style={{position:"relative",flex:1}}>
                            <span style={{position:"absolute",left:"10px",top:"50%",transform:"translateY(-50%)",fontSize:"12px",fontWeight:700,color:T.gray400,pointerEvents:"none"}}>₦</span>
                            <input value={counterInput}
                              onChange={e=>setCounterInput(e.target.value.replace(/[^0-9]/g,""))}
                              placeholder="e.g. 350000" type="text"
                              style={{width:"100%",boxSizing:"border-box",paddingLeft:"24px",paddingRight:"10px",paddingTop:"10px",paddingBottom:"10px",border:`1px solid ${counterInput?T.black:T.gray200}`,fontFamily:F,fontSize:"14px",fontWeight:800,color:T.black,outline:"none"}}/>
                          </div>
                          <button disabled={!counterInput||parseInt(counterInput)<=0}
                            onClick={()=>sendCounterOffer(counterInput)}
                            style={{background:counterInput?T.black:T.gray200,color:counterInput?T.white:T.gray400,border:"none",padding:"0 14px",fontSize:"11px",fontWeight:800,cursor:counterInput?"pointer":"not-allowed",fontFamily:F,minHeight:"44px",whiteSpace:"nowrap"}}>
                            Send →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {quoteStatus==="depot_pending"&&(
                  <div style={{padding:"14px"}}>
                    <div style={{marginBottom:"10px"}}>
                      {quoteRounds.map((r,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${T.gray100}`,gap:"10px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
                            <span style={{fontSize:"9px",fontWeight:800,padding:"1px 6px",
                              background:r.from==="buyer"?T.greenDark:T.blue,color:T.white}}>
                              {r.from==="buyer"?"YOU":"DEPOT"}
                            </span>
                            <span style={{fontSize:"10px",color:T.gray400,fontWeight:600}}>Round {i+1} · {r.time}</span>
                          </div>
                          <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>₦{(r.amount||0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{background:T.amberLight,border:`1px solid ${T.amber}`,padding:"10px 12px",fontSize:"10px",color:"#8A5C00",fontWeight:700}}>
                      ⏳ Counter-offer sent. Awaiting {depotInfo.name||order.depot}'s response.
                    </div>
                  </div>
                )}

                {quoteStatus==="agreed"&&(
                  <div style={{padding:"14px",display:"flex",alignItems:"center",gap:"12px"}}>
                    <span style={{fontSize:"22px"}}>✅</span>
                    <div>
                      <div style={{fontSize:"12px",fontWeight:800,color:T.greenDark}}>Delivery cost agreed</div>
                      <div style={{fontSize:"20px",fontWeight:800,color:T.greenDark,marginTop:"2px"}}>
                        ₦{(quoteRounds[quoteRounds.length-1]?.amount||0).toLocaleString()}
                      </div>
                      <div style={{fontSize:"10px",color:T.greenDark,marginTop:"2px",fontWeight:600}}>
                        Agreed in {quoteRounds.length} round{quoteRounds.length!==1?"s":""}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Activity feed */}
            <Card style={{marginBottom:"14px"}}>
              <SectionHead title="Activity Feed"/>
              {timeline.map((e,i)=>(
                <div key={i} style={{display:"flex",gap:"10px",paddingBottom:i<timeline.length-1?"12px":"0",position:"relative"}}>
                  {i<timeline.length-1&&<div style={{position:"absolute",left:"10px",top:"21px",bottom:0,width:"2px",background:T.gray100}}/>}
                  <div style={{width:"20px",height:"20px",borderRadius:"50%",flexShrink:0,zIndex:1,
                    background:e.actor==="buyer"?T.blueLight:e.actor==="depot"?T.greenLight:T.gray100,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:"8px",fontWeight:800,
                    color:e.actor==="buyer"?T.blue:e.actor==="depot"?T.greenDark:T.gray400}}>
                    {e.actor==="buyer"?"B":e.actor==="depot"?"D":"S"}
                  </div>
                  <div style={{flex:1,paddingTop:"1px"}}>
                    <div style={{fontSize:"11px",fontWeight:700,color:T.black,lineHeight:1.4}}>{e.event}</div>
                    <div style={{fontSize:"9px",color:T.gray400,marginTop:"2px"}}>{e.time}</div>
                  </div>
                </div>
              ))}
            </Card>

            {/* Contact actions */}
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={()=>setShowDispute(true)} style={{flex:1,background:"none",border:`2px solid ${T.red}`,color:T.red,padding:"11px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"44px"}}>⚠ Dispute</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: ORDER DETAILS ══ */}
      {activeTab==="details"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"14px"}}>
          <Card>
            <SectionHead title="Order Specifications"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 20px",marginBottom:isMulti?"14px":"0"}}>
              {[
                ["Order ID",order.id],
                ...(!isMulti?[
                  ["Product",<span style={{background:T.black,color:T.white,fontSize:"11px",fontWeight:800,padding:"2px 8px"}}>{product}</span>],
                  ["Volume",`${(vol/1000).toFixed(0)},000 L`],
                  ["Price / Litre",`₦${(meta.pricePerLitre||0).toLocaleString()}`],
                ]:[]),
                ["Trucks",`${truckCount} trucks`],
                ["Placed",meta.placed||order.placed||"—"],
                ["Confirmed",meta.confirmed||"—"],
                ["Dispatched",meta.dispatchDate||"—"],
              ].map(([l,v])=>(
                <div key={l}>
                  <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"3px"}}>{l}</div>
                  <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{v}</div>
                </div>
              ))}
            </div>
            {isMulti&&(
              <div>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"8px"}}>Products Ordered</div>
                <div style={{border:`1px solid ${T.gray100}`}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 60px",background:T.gray50,padding:"7px 12px",gap:"8px"}}>
                    {["Product","Volume","Price/L","Value"].map(h=><div key={h} style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</div>)}
                  </div>
                  {meta.products.map((p,i)=>(
                    <div key={p.name} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 60px",padding:"10px 12px",gap:"8px",borderTop:`1px solid ${T.gray100}`,alignItems:"center"}}>
                      <div>
                        <span style={{background:T.black,color:T.white,fontSize:"10px",fontWeight:800,padding:"2px 7px",marginRight:"6px"}}>{p.name}</span>
                        <span style={{fontSize:"10px",color:T.gray400}}>{p.fullName}</span>
                      </div>
                      <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{(p.vol/1000).toFixed(0)}k L</div>
                      <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>₦{p.pricePerLitre?.toLocaleString()}</div>
                      <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{fmtMoney(p.value)}</div>
                    </div>
                  ))}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 60px",padding:"10px 12px",gap:"8px",borderTop:`2px solid ${T.black}`,background:T.gray50}}>
                    <div style={{fontSize:"11px",fontWeight:800,color:T.black}}>Total</div>
                    <div style={{fontSize:"11px",fontWeight:800,color:T.black}}>{(vol/1000).toFixed(0)}k L</div>
                    <div/>
                    <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{fmtMoney(meta.value||order.value)}</div>
                  </div>
                </div>
              </div>
            )}
          </Card>
          <Card style={{padding:0,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.gray100}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <span style={{fontSize:"16px"}}>{isDelivery?"🚛":"🏭"}</span>
                <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{isDelivery?"Delivery Details":"Self Pick-up"}</div>
              </div>
              <span style={{fontSize:"9px",fontWeight:800,padding:"3px 8px",background:isDelivery?T.blueLight:T.amberLight,color:isDelivery?T.blue:"#8A5C00"}}>
                {isDelivery?"DELIVERY":"PICK-UP"}
              </span>
            </div>

            {isDelivery&&delivery?.state?(
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:`1px solid ${T.gray100}`}}>
                  <div style={{padding:"12px 16px",borderRight:`1px solid ${T.gray100}`}}>
                    <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>State</div>
                    <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{delivery.state}</div>
                  </div>
                  <div style={{padding:"12px 16px"}}>
                    <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>LGA</div>
                    <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{delivery.lga}</div>
                  </div>
                </div>
                <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.gray100}`}}>
                  <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>Street Address</div>
                  <div style={{fontSize:"13px",fontWeight:700,color:T.black,lineHeight:1.5}}>{delivery.address}</div>
                </div>
                <div style={{display:"grid",gap:"0"}}>
                  {[
                    ["From",`${depotInfo.name||order.depot} · ${depotInfo.location||"—"}`],
                    ["Loading Bay",meta.bay||"TBA"],
                    ["Loading Ref",meta.loadingRef||"TBA"],
                    ["Depot Contact",depotInfo.contact||"—"],
                  ].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 16px",borderBottom:`1px solid ${T.gray100}`,gap:"12px"}}>
                      <span style={{fontSize:"11px",color:T.gray400,fontWeight:600,flexShrink:0}}>{l}</span>
                      <span style={{fontSize:"11px",fontWeight:700,color:T.black,textAlign:"right"}}>{v}</span>
                    </div>
                  ))}
                </div>
              </>
            ):(
              <div style={{display:"grid",gap:"0"}}>
                {[
                  ["Pick-up From",`${depotInfo.name||order.depot} · ${depotInfo.location||"—"}`],
                  ["Loading Bay",meta.bay||"TBA"],
                  ["Loading Ref",meta.loadingRef||"TBA"],
                  ["Depot Contact",depotInfo.contact||"—"],
                ].map(([l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 16px",borderBottom:`1px solid ${T.gray100}`,gap:"12px"}}>
                    <span style={{fontSize:"11px",color:T.gray400,fontWeight:600,flexShrink:0}}>{l}</span>
                    <span style={{fontSize:"11px",fontWeight:700,color:T.black,textAlign:"right"}}>{v}</span>
                  </div>
                ))}
                <div style={{padding:"10px 16px",background:T.amberLight,fontSize:"10px",color:"#8A5C00",fontWeight:700}}>
                  ⚠ Your trucks must arrive at the depot for loading. Bring your waybill and gate pass.
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ══ TAB: PAYMENT ══ */}
      {activeTab==="payment"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"14px"}}>
          <Card>
            <SectionHead title="Payment Breakdown"/>
            {isMulti&&(
              <div style={{marginBottom:"12px"}}>
                {meta.products.map(p=>(
                  <div key={p.name} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${T.gray100}`,alignItems:"center"}}>
                    <span style={{fontSize:"11px",color:T.gray600,fontWeight:600,display:"flex",alignItems:"center",gap:"6px"}}>
                      <span style={{background:T.gray100,color:T.black,fontSize:"9px",fontWeight:800,padding:"1px 6px"}}>{p.name}</span>
                      {(p.vol/1000).toFixed(0)}k L
                    </span>
                    <span style={{fontSize:"12px",fontWeight:700,color:T.black}}>{fmtMoney(p.value)}</span>
                  </div>
                ))}
              </div>
            )}
            {[
              ["Product Value",fmtMoney(finials.productValue),null],
              ...(quoteStatus==="agreed"?[["Delivery Cost",`+${fmtMoney(quoteRounds[quoteRounds.length-1]?.amount||0)}`,null]]:isDelivery?[["Delivery Cost","Pending negotiation","pending"]]:[] ),
              ["Platform Fee (1%)",`-${fmtMoney(finials.platformFee)}`,"sub"],
              ["VAT (7.5%)",`-${fmtMoney(finials.vat)}`,"sub"],
            ].map(([l,v,type])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${T.gray100}`,alignItems:"center"}}>
                <span style={{fontSize:type==="sub"?"11px":"12px",color:type==="sub"?T.gray400:type==="pending"?T.gray400:T.gray600,fontWeight:type==="sub"?600:700}}>{l}</span>
                <span style={{fontSize:type==="sub"?"11px":"12px",fontWeight:700,color:type==="sub"?T.gray400:type==="pending"?T.gray400:T.gray800}}>{v}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 0 0"}}>
              <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>Total Paid</span>
              <span style={{fontSize:"16px",fontWeight:800,color:T.black}}>
                {fmtMoney((finials.productValue||0)+(finials.platformFee||0)+(finials.vat||0)+(quoteStatus==="agreed"?quoteRounds[quoteRounds.length-1]?.amount||0:0))}
              </span>
            </div>
          </Card>
          <Card>
            <SectionHead title="Payment Status"/>
            <div style={{display:"grid",gap:"0"}}>
              {[["Method","Ventryl Pay"],["Reference",order.id],
                ["Status",finials.paymentStatus==="paid"?"Completed":finials.paymentStatus==="processing"?"Processing":"Pending"],
                ["Product Value",fmtMoney(finials.productValue)],
                ...( quoteStatus==="agreed"?[["Delivery Cost",fmtMoney(quoteRounds[quoteRounds.length-1]?.amount||0)]]:isDelivery?[["Delivery Cost","Pending"]]:[] ),
                ["Total",fmtMoney((finials.productValue||0)+(finials.platformFee||0)+(finials.vat||0)+(quoteStatus==="agreed"?quoteRounds[quoteRounds.length-1]?.amount||0:0))],
              ].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${T.gray100}`}}>
                  <span style={{fontSize:"11px",color:T.gray400,fontWeight:600}}>{l}</span>
                  <span style={{fontSize:"12px",fontWeight:800,color:l==="Status"&&finials.paymentStatus==="paid"?T.greenDark:T.black}}>{v}</span>
                </div>
              ))}
            </div>
            {liveStatus==="delivered"&&!deliveryConfirmed&&(
              <button onClick={()=>setShowConfirmModal(true)} style={{marginTop:"16px",width:"100%",background:T.green,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
                Confirm Receipt to Release Payment
              </button>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   DEPOT ORDER DETAIL — Depot management view
════════════════════════════════════════════ */
function DepotOrderDetail({orderId,depot,onBack,onUpdateDepot,isMobile}) {
  const _placed = _placedOrdersStore.find(o=>o.id===orderId);
  const {depotOrders,orderDetails,loadOrderDetail}=useVentrylStore();
  useEffect(()=>{if(!_placed)loadOrderDetail(orderId);},[orderId]);
  const allDepotOrders=Object.values(depotOrders).flat();
  const dbRaw=allDepotOrders.find(o=>o.id===orderId);
  const raw = _placed||dbRaw||INCOMING.find(o=>o.id===orderId)||ORDERS.find(o=>o.id===orderId);
  const meta = _placed?.meta||orderDetails[orderId]||ORDER_META[orderId]||{};

  // Full order lifecycle state (initialized from module-level stores to survive navigation)
  const [localStatus,setLocalStatus]=useState(()=>_orderStatusStore[orderId]||raw?.status||"pending");
  const [bay,setBay]=useState(()=>_orderBayStore[orderId]||meta.bay||"");
  const [truckList,setTruckList]=useState(()=>_orderTruckListStore[orderId]||(meta.trucks_detail||[]).map(t=>({...t})));
  const [dispatchConfirm,setDispatchConfirm]=useState(false);
  const [dispatched,setDispatched]=useState(()=>_orderDispatchedStore[orderId]||false);
  const [deliveryNote,setDeliveryNote]=useState("");
  const [showDispute,setShowDispute]=useState(false);
  const [activeTab,setActiveTab]=useState("manage");

  // Status update drawer state
  const [showStatusUpdate,setShowStatusUpdate]=useState(false);
  const [pendingStatus,setPendingStatus]=useState("");
  const [statusNote,setStatusNote]=useState("");
  const [statusLog,setStatusLog]=useState(()=>_orderStatusLogStore[orderId]||[]);  // [{from,to,note,time}]
  // Truck dispatch entry (delivery mode)
  const defaultTruckCount=meta.trucks||raw.trucks||1;
  const emptyTruck=()=>({driver:"",plate:"",vol:"",eta:""});
  const [truckInputs,setTruckInputs]=useState(()=>Array.from({length:defaultTruckCount},emptyTruck));
  const totalOrderVol=meta.vol||raw.vol||0;
  const truckVolTotal=truckInputs.reduce((s,t)=>s+(parseInt(t.vol)||0),0);
  const trucksValid=truckInputs.length>0&&truckInputs.every(t=>t.driver.trim()&&t.plate.trim()&&parseInt(t.vol)>0)&&truckVolTotal>0;
  const updateTruck=(i,field,val)=>setTruckInputs(list=>list.map((t,idx)=>idx===i?{...t,[field]:val}:t));
  const addTruck=()=>setTruckInputs(list=>[...list,emptyTruck()]);
  const removeTruck=(i)=>setTruckInputs(list=>list.filter((_,idx)=>idx!==i));

  // Pickup-specific gate clearance (persisted via _gateRecordStore)
  const emptyBuyerTruck=()=>({plate:"",vol:"",driver:""});
  const [buyerTrucks,setBuyerTrucks]=useState(()=>_gateRecordStore[orderId]?.buyerTrucks||[emptyBuyerTruck()]);
  const [gateNote,setGateNote]=useState(()=>_gateRecordStore[orderId]?.gateNote||"");
  const [waybillRef,setWaybillRef]=useState(()=>_gateRecordStore[orderId]?.waybillRef||"");
  const buyerTruckVolTotal=buyerTrucks.reduce((s,t)=>s+(parseInt(t.vol)||0),0);
  const buyerTrucksValid=buyerTrucks.length>0&&buyerTrucks.every(t=>t.plate.trim()&&parseInt(t.vol)>0)&&buyerTruckVolTotal>0;
  const updateBuyerTruck=(i,field,val)=>setBuyerTrucks(list=>list.map((t,idx)=>idx===i?{...t,[field]:val}:t));
  const addBuyerTruck=()=>setBuyerTrucks(list=>[...list,emptyBuyerTruck()]);
  const removeBuyerTruck=(i)=>setBuyerTrucks(list=>list.filter((_,idx)=>idx!==i));

  // Delivery cost negotiation state
  const [quoteRounds,setQuoteRounds]=useState(()=>(_deliveryQuoteStore[orderId]||{rounds:[]}).rounds);
  const [quoteStatus,setQuoteStatus]=useState(()=>(_deliveryQuoteStore[orderId]||{status:"none"}).status);
  const [depotCostInput,setDepotCostInput]=useState("");
  const [depotReQuoteInput,setDepotReQuoteInput]=useState("");
  const [showDepotReQuote,setShowDepotReQuote]=useState(false);

  const sendDeliveryQuote=(amount)=>{
    const now=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    const round={from:"depot",amount:parseInt(amount),time:now};
    const newRounds=[...quoteRounds,round];
    const newStatus="buyer_pending";
    setQuoteRounds(newRounds);
    setQuoteStatus(newStatus);
    _deliveryQuoteStore[orderId]={rounds:newRounds,status:newStatus};
    setDepotCostInput("");
    setDepotReQuoteInput("");
    setShowDepotReQuote(false);
  };

  const acceptBuyerCounterOffer=()=>{
    const newStatus="agreed";
    _deliveryQuoteStore[orderId]={rounds:quoteRounds,status:newStatus};
    setQuoteStatus(newStatus);
    setShowDepotReQuote(false);
  };

  if(!raw) return (
    <div style={{padding:"40px",textAlign:"center"}}>
      <div style={{fontSize:"14px",fontWeight:700,color:T.gray400}}>Order not found.</div>
      <button onClick={onBack} style={{marginTop:"16px",background:T.black,color:T.white,border:"none",padding:"9px 18px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F}}>← Back</button>
    </div>
  );

  const buyerInfo=meta.buyer||{};
  const finials=meta.financials||{};
  const timeline=meta.timeline||[];
  const fmtMoney=n=>n>=1e6?`₦${(n/1e6).toFixed(2)}M`:`₦${n?.toLocaleString()}`;
  const isMultiDepot=Array.isArray(meta.products)&&meta.products.length>1;
  const orderProductLabel=isMultiDepot?meta.products.map(p=>p.name).join(" + "):(meta.product||raw.product||"");
  const delivery=meta.delivery||null;
  const isDelivery=!delivery||delivery.mode==="delivery";

  const isPickup=delivery?.mode==="pickup";
  const STATUS_STEPS=isPickup
    ?["pending","confirmed","loading","collected"]
    :["pending","confirmed","loading","in_transit","delivered"];
  const STEP_LABELS=isPickup
    ?["Received","Confirmed","Loading","Collected"]
    :["Received","Confirmed","Loading","Dispatched","Delivered"];
  const currentStep=Math.max(0,STATUS_STEPS.indexOf(localStatus));
  const BAYS=["Bay 1","Bay 2","Bay 3"];
  const allTrucksDelivered=truckList.length>0&&truckList.every(t=>t.status==="delivered");

  const applyStatusUpdate=(toStatus,note,newBay,trucks)=>{
    const prev=localStatus;
    const entry={from:prev,to:toStatus,note:note||"",time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})};
    const newLog=[...statusLog,entry];
    _orderStatusLogStore[orderId]=newLog;
    setStatusLog(newLog);
    _orderStatusStore[orderId]=toStatus;
    setLocalStatus(toStatus);
    if(toStatus==="loading"&&newBay){_orderBayStore[orderId]=newBay;setBay(newBay);}
    if(toStatus==="in_transit"){
      _orderDispatchedStore[orderId]=true;
      setDispatched(true);
      if(trucks&&trucks.length>0){
        const newTrucks=trucks.map((t,i)=>({
          id:`T${i+1}`,driver:t.driver,plate:t.plate,vol:parseInt(t.vol),
          departure:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
          eta:t.eta||"—",arrivalTime:null,progress:0,status:"in_transit"
        }));
        _orderTruckListStore[orderId]=newTrucks;
        setTruckList(newTrucks);
      }
    }
    if(toStatus==="delivered"||toStatus==="collected"){
      const newTrucks=truckList.map(t=>({...t,status:"delivered",progress:100}));
      _orderTruckListStore[orderId]=newTrucks;
      setTruckList(newTrucks);
    }
    if(toStatus==="collected"){
      _gateRecordStore[orderId]={buyerTrucks,waybillRef,gateNote};
    }
    setShowStatusUpdate(false);
    setStatusNote("");
    setPendingStatus("");
  };

  const handleConfirm=()=>applyStatusUpdate("confirmed","Order confirmed by depot");
  const handleReject=()=>applyStatusUpdate("rejected","Order rejected");
  const handleMarkTruckDelivered=(idx)=>{
    const next=[...truckList];
    next[idx]={...next[idx],status:"delivered",progress:100};
    _orderTruckListStore[orderId]=next;
    setTruckList(next);
    if(next.every(t=>t.status==="delivered"))applyStatusUpdate("delivered","All trucks delivered");
  };

  return (
    <div>
      {/* Modals */}
      {showDispute&&<DisputeModal onClose={()=>setShowDispute(false)} orderId={raw.id} product={meta.product||raw.product} vol={meta.vol||raw.vol||33000}/>}

      {/* Back + header */}
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px",flexWrap:"wrap"}}>
        <button onClick={onBack} style={{background:"none",border:`1px solid ${T.gray200}`,color:T.black,padding:"7px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>← Back</button>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
            <span style={{fontSize:isMobile?"16px":"20px",fontWeight:800,color:T.black}}>{raw.id}</span>
            <Badge status={localStatus}/>
            {localStatus==="pending"&&<span style={{background:T.red,color:T.white,fontSize:"9px",fontWeight:800,padding:"2px 8px",letterSpacing:"0.06em",animation:"pulse 1.6s infinite"}}>ACTION REQUIRED</span>}
          </div>
          <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{buyerInfo.company||raw.buyer} · {orderProductLabel} · {meta.placed||raw.submitted||""}</div>
        </div>
        <div style={{display:"flex",gap:"8px",flexShrink:0}}>
          {localStatus!=="rejected"&&<button onClick={()=>setShowDispute(true)} style={{background:"none",border:`1px solid ${T.red}`,color:T.red,padding:"7px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"36px"}}>⚠ Flag</button>}
        </div>
      </div>

      {/* Status Stepper */}
      {localStatus!=="rejected"&&(
        <Card style={{marginBottom:"14px"}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",position:"relative",paddingBottom:"4px"}}>
            <div style={{position:"absolute",top:"13px",left:"13px",right:"13px",height:"2px",background:T.gray100,zIndex:0}}/>
            <div style={{position:"absolute",top:"13px",left:"13px",height:"2px",width:`${Math.max(0,(currentStep/(STATUS_STEPS.length-1))*100)}%`,background:T.green,zIndex:1,transition:"width 0.5s"}}/>
            {STATUS_STEPS.map((s,i)=>{
              const done=i<currentStep;
              const active=i===currentStep;
              return (
                <div key={s} style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1,position:"relative",zIndex:2}}>
                  <div style={{width:"26px",height:"26px",borderRadius:"50%",background:done?T.green:active?T.black:T.white,border:`2px solid ${done?T.green:active?T.black:T.gray200}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:800,color:done||active?T.white:T.gray400,transition:"all 0.3s",boxShadow:active?"0 0 0 4px rgba(0,0,0,0.1)":"none"}}>
                    {done?"✓":i+1}
                  </div>
                  <div style={{marginTop:"5px",fontSize:"9px",fontWeight:700,color:done||active?T.black:T.gray400,textTransform:"uppercase",letterSpacing:"0.03em",textAlign:"center"}}>{STEP_LABELS[i]}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {localStatus==="rejected"&&(
        <div style={{background:T.redLight,border:`1px solid ${T.red}`,padding:"14px 18px",marginBottom:"14px"}}>
          <div style={{fontSize:"13px",fontWeight:800,color:T.red}}>Order Rejected</div>
          <div style={{fontSize:"11px",color:T.red,marginTop:"2px"}}>Payment has been returned to the buyer. This order is closed.</div>
        </div>
      )}

      {/* ── ACTION PANEL — one focused card per stage ── */}
      {localStatus==="pending"&&(
        <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
          <div style={{background:T.black,padding:"14px 18px"}}>
            <div style={{fontSize:"12px",fontWeight:800,color:T.white,marginBottom:"2px"}}>New Order · Action Required</div>
            <div style={{fontSize:"11px",color:T.gray400}}>{buyerInfo.company||raw.buyer} · {fmtMoney(finials.productValue||0)} · SLA: {raw.slaLeft||"—"}</div>
          </div>
          <div style={{padding:"16px 18px",display:"flex",gap:"8px",flexWrap:"wrap"}}>
            <button onClick={handleConfirm}
              style={{flex:1,background:T.green,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
              Confirm Order ✓
            </button>
            <button onClick={handleReject}
              style={{background:"none",color:T.red,border:`1px solid ${T.red}`,padding:"12px 20px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
              Reject
            </button>
          </div>
        </Card>
      )}

      {/* ── DELIVERY COST NEGOTIATION — confirmed delivery orders only ── */}
      {localStatus==="confirmed"&&isDelivery&&(
        <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
          {quoteStatus==="none"&&(
            <>
              <div style={{background:"#12122A",padding:"14px 18px",display:"flex",alignItems:"center",gap:"12px"}}>
                <span style={{fontSize:"20px"}}>💰</span>
                <div>
                  <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>Set Delivery Cost</div>
                  <div style={{fontSize:"11px",color:"#aaa",marginTop:"1px"}}>
                    Quote the delivery fee to {delivery?.lga}, {delivery?.state}. Buyer will approve or counter-offer.
                  </div>
                </div>
              </div>
              <div style={{padding:"16px 18px"}}>
                <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"7px"}}>Delivery Cost (₦)</div>
                <div style={{display:"flex",gap:"8px",alignItems:"stretch"}}>
                  <div style={{position:"relative",flex:1}}>
                    <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",fontSize:"13px",fontWeight:700,color:T.gray400,pointerEvents:"none"}}>₦</span>
                    <input value={depotCostInput}
                      onChange={e=>setDepotCostInput(e.target.value.replace(/[^0-9]/g,""))}
                      placeholder="e.g. 450000" type="text"
                      style={{width:"100%",boxSizing:"border-box",paddingLeft:"28px",paddingRight:"12px",paddingTop:"12px",paddingBottom:"12px",border:`1px solid ${depotCostInput?T.black:T.gray200}`,fontFamily:F,fontSize:"15px",fontWeight:800,color:T.black,outline:"none"}}/>
                  </div>
                  <button disabled={!depotCostInput||parseInt(depotCostInput)<=0}
                    onClick={()=>sendDeliveryQuote(depotCostInput)}
                    style={{background:depotCostInput?T.black:T.gray200,color:depotCostInput?T.white:T.gray400,border:"none",padding:"0 20px",fontSize:"12px",fontWeight:800,cursor:depotCostInput?"pointer":"not-allowed",fontFamily:F,whiteSpace:"nowrap",minHeight:"48px"}}>
                    Send to Buyer →
                  </button>
                </div>
                {depotCostInput&&parseInt(depotCostInput)>0&&(
                  <div style={{marginTop:"7px",fontSize:"10px",color:T.gray400,fontWeight:600}}>
                    ≈ ₦{(parseInt(depotCostInput)/1000).toFixed(0)}k · ₦{(parseInt(depotCostInput)/(totalOrderVol||1)).toFixed(2)}/L surcharge
                  </div>
                )}
              </div>
            </>
          )}

          {quoteStatus==="buyer_pending"&&(
            <>
              <div style={{background:"#12122A",padding:"14px 18px",display:"flex",alignItems:"center",gap:"12px"}}>
                <span style={{fontSize:"20px"}}>⏳</span>
                <div>
                  <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>Quote Sent — Awaiting Buyer</div>
                  <div style={{fontSize:"11px",color:"#aaa",marginTop:"1px"}}>{buyerInfo.company||raw.buyer} is reviewing your delivery cost.</div>
                </div>
              </div>
              <div style={{padding:"14px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:T.gray50,border:`1px solid ${T.gray100}`,marginBottom:"8px"}}>
                  <span style={{fontSize:"11px",color:T.gray400,fontWeight:600}}>Your Quote</span>
                  <span style={{fontSize:"20px",fontWeight:800,color:T.black}}>₦{(quoteRounds[quoteRounds.length-1]?.amount||0).toLocaleString()}</span>
                </div>
                <div style={{fontSize:"10px",color:T.gray400,fontWeight:600}}>Sent {quoteRounds[quoteRounds.length-1]?.time||"—"} · Waiting for buyer approval or counter-offer.</div>
              </div>
            </>
          )}

          {quoteStatus==="depot_pending"&&(
            <>
              <div style={{background:"#2E1500",padding:"14px 18px",display:"flex",alignItems:"center",gap:"12px"}}>
                <span style={{fontSize:"20px"}}>💬</span>
                <div>
                  <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>Counter-Offer Received</div>
                  <div style={{fontSize:"11px",color:"#aaa",marginTop:"1px"}}>{buyerInfo.company||raw.buyer} wants a different delivery price.</div>
                </div>
                <span style={{marginLeft:"auto",background:T.amber,color:T.black,fontSize:"9px",fontWeight:800,padding:"3px 8px",flexShrink:0}}>ACTION</span>
              </div>
              <div style={{padding:"14px 18px"}}>
                <div style={{marginBottom:"12px"}}>
                  {quoteRounds.map((r,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",background:r.from==="buyer"?T.amberLight:T.blueLight,marginBottom:"4px",gap:"10px",border:`1px solid ${r.from==="buyer"?"#FFDD8A":"#C3D7FC"}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                        <span style={{fontSize:"9px",fontWeight:800,padding:"2px 7px",background:r.from==="buyer"?"#8A5C00":T.blue,color:T.white}}>
                          {r.from==="buyer"?"BUYER":"YOU"}
                        </span>
                        <span style={{fontSize:"10px",color:T.gray600,fontWeight:600}}>Round {i+1} · {r.time}</span>
                      </div>
                      <span style={{fontSize:"15px",fontWeight:800,color:T.black}}>₦{(r.amount||0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:showDepotReQuote?"12px":"0"}}>
                  <button onClick={acceptBuyerCounterOffer}
                    style={{flex:1,background:T.green,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
                    Accept ₦{(quoteRounds[quoteRounds.length-1]?.amount||0).toLocaleString()} ✓
                  </button>
                  <button onClick={()=>setShowDepotReQuote(!showDepotReQuote)}
                    style={{flex:1,background:T.black,color:T.white,border:"none",padding:"12px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"46px"}}>
                    {showDepotReQuote?"Cancel":"Re-quote →"}
                  </button>
                </div>
                {showDepotReQuote&&(
                  <div>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Your New Quote (₦)</div>
                    <div style={{display:"flex",gap:"8px"}}>
                      <div style={{position:"relative",flex:1}}>
                        <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",fontSize:"13px",fontWeight:700,color:T.gray400,pointerEvents:"none"}}>₦</span>
                        <input value={depotReQuoteInput}
                          onChange={e=>setDepotReQuoteInput(e.target.value.replace(/[^0-9]/g,""))}
                          placeholder="e.g. 380000" type="text"
                          style={{width:"100%",boxSizing:"border-box",paddingLeft:"28px",paddingRight:"12px",paddingTop:"11px",paddingBottom:"11px",border:`1px solid ${depotReQuoteInput?T.black:T.gray200}`,fontFamily:F,fontSize:"14px",fontWeight:800,color:T.black,outline:"none"}}/>
                      </div>
                      <button disabled={!depotReQuoteInput}
                        onClick={()=>sendDeliveryQuote(depotReQuoteInput)}
                        style={{background:depotReQuoteInput?T.black:T.gray200,color:depotReQuoteInput?T.white:T.gray400,border:"none",padding:"0 16px",fontSize:"12px",fontWeight:800,cursor:depotReQuoteInput?"pointer":"not-allowed",fontFamily:F,minHeight:"46px",whiteSpace:"nowrap"}}>
                        Send →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {quoteStatus==="agreed"&&(
            <div style={{padding:"16px 18px",display:"flex",alignItems:"center",gap:"14px",background:T.greenLight}}>
              <span style={{fontSize:"24px"}}>✅</span>
              <div style={{flex:1}}>
                <div style={{fontSize:"13px",fontWeight:800,color:T.greenDark}}>Delivery Cost Agreed</div>
                <div style={{fontSize:"11px",color:T.greenDark,marginTop:"2px"}}>
                  Agreed in {quoteRounds.length} round{quoteRounds.length!==1?"s":""} · Now assign a loading bay below.
                </div>
              </div>
              <span style={{fontSize:"20px",fontWeight:800,color:T.greenDark}}>₦{(quoteRounds[quoteRounds.length-1]?.amount||0).toLocaleString()}</span>
            </div>
          )}
        </Card>
      )}

      {localStatus==="confirmed"&&(!isDelivery||quoteStatus==="agreed")&&(
        <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
          <div style={{background:"#1A3A0A",padding:"14px 18px",display:"flex",alignItems:"center",gap:"10px"}}>
            <span style={{fontSize:"18px"}}>{isPickup?"🏭":"🏗"}</span>
            <div>
              <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>
                {isPickup?"Assign Bay & Await Buyer Trucks":"Assign Bay & Start Loading"}
              </div>
              <div style={{fontSize:"11px",color:"#aaa",marginTop:"1px"}}>
                {isPickup?"Select a loading bay. The buyer will arrive with their own trucks.":"Select a loading bay then confirm to begin loading."}
              </div>
            </div>
          </div>
          <div style={{padding:"16px 18px"}}>
            {isPickup&&(
              <div style={{background:T.amberLight,border:`1px solid ${T.amber}`,padding:"10px 14px",marginBottom:"14px",display:"flex",gap:"10px",alignItems:"flex-start"}}>
                <span style={{fontSize:"16px",flexShrink:0}}>⚠</span>
                <div>
                  <div style={{fontSize:"11px",fontWeight:800,color:"#8A5C00",marginBottom:"2px"}}>Self Pick-up Order</div>
                  <div style={{fontSize:"10px",color:"#8A5C00",lineHeight:1.5}}>
                    {buyerInfo.company||raw.buyer} will dispatch their own trucks to collect this order.
                    Confirm their arrival and verify truck details before beginning loading.
                  </div>
                </div>
              </div>
            )}
            <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"8px"}}>Loading Bay</div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"14px"}}>
              {BAYS.map(b=>(
                <button key={b} onClick={()=>setBay(bay===b?"":b)}
                  style={{padding:"10px 20px",border:`2px solid ${bay===b?T.black:T.gray200}`,background:bay===b?T.black:T.white,color:bay===b?T.white:T.black,fontFamily:F,fontSize:"12px",fontWeight:800,cursor:"pointer",minHeight:"42px",transition:"all 0.15s"}}>
                  {b}
                </button>
              ))}
            </div>
            <input value={statusNote} onChange={e=>setStatusNote(e.target.value)}
              placeholder={isPickup?"Note (optional) — e.g. Buyer ETA 14:00":"Note (optional) — e.g. Loading crew assigned"}
              style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"12px",color:T.black,outline:"none",marginBottom:"12px",boxSizing:"border-box"}}/>
            <button
              disabled={!bay}
              onClick={()=>applyStatusUpdate("loading",statusNote||( isPickup?"Awaiting buyer trucks":"Loading started"),bay)}
              style={{width:"100%",background:bay?T.green:T.gray200,color:bay?T.white:T.gray400,border:"none",padding:"13px",fontSize:"13px",fontWeight:800,cursor:bay?"pointer":"not-allowed",fontFamily:F,minHeight:"48px"}}>
              {bay?(isPickup?`Assign ${bay} — Awaiting Trucks ✓`:`Start Loading at ${bay} ✓`):"Select a bay to continue"}
            </button>
          </div>
        </Card>
      )}

      {localStatus==="loading"&&!isPickup&&(
        <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
          <div style={{background:"#0A1F3A",padding:"14px 18px",display:"flex",alignItems:"center",gap:"10px"}}>
            <span style={{fontSize:"18px"}}>🚛</span>
            <div>
              <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>Enter Truck Details &amp; Dispatch</div>
              <div style={{fontSize:"11px",color:"#aaa",marginTop:"1px"}}>
                {bay&&<span style={{color:T.green,fontWeight:700}}>{bay} · </span>}
                {(totalOrderVol/1000).toFixed(0)}k L · {defaultTruckCount} truck{defaultTruckCount!==1?"s":""} expected
              </div>
            </div>
            <button onClick={addTruck}
              style={{marginLeft:"auto",background:"rgba(255,255,255,0.1)",color:T.white,border:"1px solid rgba(255,255,255,0.2)",padding:"6px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"32px",whiteSpace:"nowrap"}}>
              + Add Truck
            </button>
          </div>
          <div style={{padding:"12px 18px"}}>
            {truckInputs.map((t,i)=>(
              <div key={i} style={{border:`1px solid ${T.gray100}`,background:T.gray50,padding:"12px",marginBottom:"8px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
                  <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>Truck {i+1}</span>
                  {truckInputs.length>1&&(
                    <button onClick={()=>removeTruck(i)}
                      style={{background:"none",border:"none",color:T.red,fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,padding:0}}>
                      Remove
                    </button>
                  )}
                </div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:"8px"}}>
                  {[
                    {label:"Driver Name *",   field:"driver", ph:"e.g. Musa Ibrahim",   req:true,  type:"text"},
                    {label:"Plate Number *",  field:"plate",  ph:"e.g. LG-123-ABC",    req:true,  type:"text"},
                    {label:"Volume (L) *",    field:"vol",    ph:"e.g. 33000",          req:true,  type:"number"},
                    {label:"Est. Delivery",   field:"eta",    ph:"e.g. 4–6 hrs",        req:false, type:"text"},
                  ].map(({label,field,ph,req,type})=>(
                    <div key={field}>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>{label}</div>
                      <input value={t[field]} type={type}
                        onChange={e=>updateTruck(i,field,field==="plate"?e.target.value.toUpperCase():e.target.value)}
                        placeholder={ph}
                        style={{width:"100%",border:`1px solid ${req&&!t[field]?T.amber:T.gray200}`,padding:"8px 10px",fontFamily:F,fontSize:"11px",color:T.black,outline:"none",background:T.white,boxSizing:"border-box"}}/>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",marginBottom:"10px",
              background:truckVolTotal===totalOrderVol?T.greenLight:truckVolTotal>0?T.amberLight:T.gray50}}>
              <span style={{fontSize:"11px",fontWeight:700,color:truckVolTotal===totalOrderVol?T.greenDark:truckVolTotal>0?"#8A5C00":T.gray400}}>
                {truckVolTotal===totalOrderVol?"✓ Volume matches order":truckVolTotal>0?`⚠ ${(truckVolTotal/1000).toFixed(1)}k / ${(totalOrderVol/1000).toFixed(1)}k L`:"Enter truck volumes"}
              </span>
              <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>{(truckVolTotal/1000).toFixed(1)}k / {(totalOrderVol/1000).toFixed(1)}k L</span>
            </div>
            <input value={statusNote} onChange={e=>setStatusNote(e.target.value)}
              placeholder="Dispatch note (optional) — e.g. Waybill refs attached"
              style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"12px",color:T.black,outline:"none",marginBottom:"12px",boxSizing:"border-box"}}/>
            <button
              disabled={!trucksValid}
              onClick={()=>applyStatusUpdate("in_transit",statusNote,bay,truckInputs)}
              style={{width:"100%",background:trucksValid?T.green:T.gray200,color:trucksValid?T.white:T.gray400,border:"none",padding:"13px",fontSize:"13px",fontWeight:800,cursor:trucksValid?"pointer":"not-allowed",fontFamily:F,minHeight:"48px"}}>
              {trucksValid?`Dispatch ${truckInputs.length} Truck${truckInputs.length!==1?"s":""} ✓`:"Fill in all truck details to dispatch"}
            </button>
          </div>
        </Card>
      )}

      {/* ── PICKUP: Gate Clearance & Mark Collected ── */}
      {localStatus==="loading"&&isPickup&&(
        <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
          <div style={{background:"#1A2E0A",padding:"14px 18px",display:"flex",alignItems:"center",gap:"10px"}}>
            <span style={{fontSize:"18px"}}>🏭</span>
            <div style={{flex:1}}>
              <div style={{fontSize:"12px",fontWeight:800,color:T.white}}>Gate Clearance — Buyer Trucks On-Site</div>
              <div style={{fontSize:"11px",color:"#aaa",marginTop:"1px"}}>
                {bay&&<span style={{color:T.green,fontWeight:700}}>{bay} · </span>}
                Record buyer truck details, then mark as collected when loading is complete.
              </div>
            </div>
            <button onClick={addBuyerTruck}
              style={{background:"rgba(255,255,255,0.1)",color:T.white,border:"1px solid rgba(255,255,255,0.2)",padding:"6px 12px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"32px",whiteSpace:"nowrap",flexShrink:0}}>
              + Add Truck
            </button>
          </div>

          <div style={{padding:"14px 18px"}}>
            {/* Buyer truck entries */}
            {buyerTrucks.map((t,i)=>(
              <div key={i} style={{border:`1px solid ${T.gray100}`,background:T.gray50,padding:"12px",marginBottom:"8px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>Buyer Truck {i+1}</span>
                    <span style={{fontSize:"9px",background:T.amberLight,color:"#8A5C00",fontWeight:700,padding:"1px 6px"}}>GATE RECORD</span>
                  </div>
                  {buyerTrucks.length>1&&(
                    <button onClick={()=>removeBuyerTruck(i)}
                      style={{background:"none",border:"none",color:T.red,fontSize:"11px",fontWeight:700,cursor:"pointer",fontFamily:F,padding:0}}>
                      Remove
                    </button>
                  )}
                </div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:"8px"}}>
                  {[
                    {label:"Plate Number *", field:"plate",  ph:"e.g. LG-456-XY",  req:true,  type:"text"},
                    {label:"Volume (L) *",   field:"vol",    ph:"e.g. 33000",       req:true,  type:"number"},
                    {label:"Driver Name",    field:"driver", ph:"e.g. Musa Ibrahim",req:false, type:"text"},
                  ].map(({label,field,ph,req,type})=>(
                    <div key={field}>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>{label}</div>
                      <input value={t[field]} type={type}
                        onChange={e=>updateBuyerTruck(i,field,field==="plate"?e.target.value.toUpperCase():e.target.value)}
                        placeholder={ph}
                        style={{width:"100%",border:`1px solid ${req&&!t[field]?T.amber:T.gray200}`,padding:"8px 10px",fontFamily:F,fontSize:"11px",color:T.black,outline:"none",background:T.white,boxSizing:"border-box"}}/>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Volume check */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",marginBottom:"12px",
              background:buyerTruckVolTotal===totalOrderVol?T.greenLight:buyerTruckVolTotal>0?T.amberLight:T.gray50}}>
              <span style={{fontSize:"11px",fontWeight:700,color:buyerTruckVolTotal===totalOrderVol?T.greenDark:buyerTruckVolTotal>0?"#8A5C00":T.gray400}}>
                {buyerTruckVolTotal===totalOrderVol?"✓ Volume matches order":buyerTruckVolTotal>0?`⚠ ${(buyerTruckVolTotal/1000).toFixed(1)}k / ${(totalOrderVol/1000).toFixed(1)}k L`:"Enter truck volumes"}
              </span>
              <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>{(buyerTruckVolTotal/1000).toFixed(1)}k / {(totalOrderVol/1000).toFixed(1)}k L</span>
            </div>

            {/* Waybill ref */}
            <div style={{marginBottom:"10px"}}>
              <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"5px"}}>Waybill / Gate Pass Reference</div>
              <input value={waybillRef} onChange={e=>setWaybillRef(e.target.value)}
                placeholder="e.g. WB-2026-0042"
                style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"12px",color:T.black,outline:"none",boxSizing:"border-box"}}/>
            </div>

            <input value={gateNote} onChange={e=>setGateNote(e.target.value)}
              placeholder="Collection note (optional) — e.g. Gate B used, all checks passed"
              style={{width:"100%",border:`1px solid ${T.gray200}`,padding:"9px 12px",fontFamily:F,fontSize:"12px",color:T.black,outline:"none",marginBottom:"12px",boxSizing:"border-box"}}/>

            <button
              disabled={!buyerTrucksValid}
              onClick={()=>applyStatusUpdate("collected",gateNote||(waybillRef?`Waybill: ${waybillRef}`:"Collected by buyer"),bay)}
              style={{width:"100%",background:buyerTrucksValid?T.green:T.gray200,color:buyerTrucksValid?T.white:T.gray400,border:"none",padding:"13px",fontSize:"13px",fontWeight:800,cursor:buyerTrucksValid?"pointer":"not-allowed",fontFamily:F,minHeight:"48px"}}>
              {buyerTrucksValid?"Mark as Collected ✓":"Enter plate number and volume to continue"}
            </button>
          </div>
        </Card>
      )}

      {localStatus==="in_transit"&&!isPickup&&(
        <Card style={{marginBottom:"14px",background:"#0A1F3A",border:"none"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            <span style={{fontSize:"24px"}}>🚛</span>
            <div style={{flex:1}}>
              <div style={{fontSize:"13px",fontWeight:800,color:T.white}}>Trucks in Transit</div>
              <div style={{fontSize:"11px",color:"#aaa",marginTop:"2px"}}>
                {truckList.filter(t=>t.status==="delivered").length} of {truckList.length||defaultTruckCount} trucks delivered · Mark each truck below as it arrives
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Status history log */}
      {statusLog.length>0&&(
        <Card style={{marginBottom:"14px"}}>
          <SectionHead title="Activity Log"/>
          {statusLog.map((e,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"10px",padding:"8px 0",borderBottom:i<statusLog.length-1?`1px solid ${T.gray100}`:"none"}}>
              <div style={{width:"8px",height:"8px",borderRadius:"50%",background:T.green,marginTop:"4px",flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>
                  {STEP_LABELS[STATUS_STEPS.indexOf(e.from)]||e.from} → {STEP_LABELS[STATUS_STEPS.indexOf(e.to)]||(e.to==="collected"?"Collected":e.to)}
                </div>
                {e.note&&<div style={{fontSize:"11px",color:T.gray400,marginTop:"1px"}}>{e.note}</div>}
                <div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>{e.time}</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {(localStatus==="delivered"||localStatus==="collected")&&(
        <div style={{background:T.greenLight,border:`1px solid ${T.green}`,padding:"16px 20px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"14px"}}>
          <span style={{fontSize:"28px"}}>✅</span>
          <div style={{flex:1}}>
            <div style={{fontSize:"14px",fontWeight:800,color:T.greenDark}}>
              {localStatus==="collected"?"Order Complete — Collected by Buyer":"Order Complete — Delivered"}
            </div>
            <div style={{fontSize:"11px",color:T.greenDark,marginTop:"3px"}}>
              Net revenue: {fmtMoney((finials.netToDepot||0)+(quoteStatus==="agreed"?quoteRounds[quoteRounds.length-1]?.amount||0:0))}
              {quoteStatus==="agreed"&&<span style={{marginLeft:"8px",fontSize:"10px",fontWeight:600,opacity:0.8}}>(incl. ₦{(quoteRounds[quoteRounds.length-1]?.amount||0).toLocaleString()} delivery)</span>}
            </div>
            {waybillRef&&localStatus==="collected"&&<div style={{fontSize:"10px",color:T.greenDark,marginTop:"3px",fontWeight:600}}>Waybill: {waybillRef}</div>}
            {statusLog.length>0&&<div style={{fontSize:"10px",color:T.greenDark,marginTop:"4px",fontWeight:600}}>Completed: {statusLog[statusLog.length-1]?.time}</div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"7px",flexShrink:0}}>
            <button
              onClick={()=>printWaybill({
                orderId,
                product:orderProductLabel,
                vol:meta.vol||raw.vol||0,
                buyer:raw.buyer||"Buyer",
                buyerAddr:"Lagos, Nigeria",
                depot:depot?.name||"Depot",
                depotAddr:depot?.location||"Lagos, Nigeria",
                depotLicense:depot?.license||"",
                trucks:truckList.length>0?truckList:buyerTrucks.filter(t=>t.plate),
                bay,
                loadRef:meta.loadRef||"",
                waybillRef,
                type:isPickup?"pickup":"delivery",
              })}
              style={{background:T.black,color:T.white,border:"none",padding:"8px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"34px",whiteSpace:"nowrap"}}>
              ⬇ Waybill
            </button>
            <button
              onClick={()=>printInvoice({
                orderId,
                product:orderProductLabel,
                vol:meta.vol||raw.vol||0,
                pricePerLitre:finials.price_per_litre||0,
                buyer:raw.buyer||"Buyer",
                buyerAddr:"Lagos, Nigeria",
                depot:depot?.name||"Depot",
                depotAddr:depot?.location||"Lagos, Nigeria",
                depotLicense:depot?.license||"",
                vat:true,
              })}
              style={{background:T.white,color:T.black,border:`1px solid ${T.green}`,padding:"8px 14px",fontSize:"11px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"34px",whiteSpace:"nowrap"}}>
              ⬇ Invoice
            </button>
          </div>
        </div>
      )}

      {localStatus==="rejected"&&(
        <div style={{background:T.redLight,border:`1px solid ${T.red}`,padding:"14px 18px",marginBottom:"14px"}}>
          <div style={{fontSize:"13px",fontWeight:800,color:T.red}}>Order Rejected</div>
          <div style={{fontSize:"11px",color:T.red,marginTop:"2px"}}>Payment has been returned to the buyer. This order is closed.</div>
        </div>
      )}

      {/* Dispatch modal (legacy — kept for dispatch confirm flow from truck management) */}
      {/* Sub-tabs */}
      <div style={{display:"flex",borderBottom:`2px solid ${T.gray100}`,marginBottom:"16px",gap:"0"}}>
        {[["manage","Order Management"],["timeline","Timeline"],["financials","Financials"]].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)} style={{padding:"9px 16px",background:"none",border:"none",cursor:"pointer",fontFamily:F,fontSize:"12px",fontWeight:activeTab===id?800:600,color:activeTab===id?T.black:T.gray400,borderBottom:`2px solid ${activeTab===id?T.black:"transparent"}`,marginBottom:"-2px",transition:"all 0.15s"}}>{label}</button>
        ))}
      </div>

      {/* ── TAB: ORDER MANAGEMENT ── */}
      {activeTab==="manage"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.3fr 1fr",gap:"14px",alignItems:"start"}}>
          <div>
            {/* Buyer Info */}
            <Card style={{marginBottom:"14px"}}>
              <SectionHead title="Buyer"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 20px"}}>
                {[["Company",buyerInfo.company||raw.buyer],["Type",buyerInfo.type||raw.type||"—"],["Contact",buyerInfo.name||"—"],["Phone",buyerInfo.phone||"—"],["Email",buyerInfo.email||"—"],["Business Address",buyerInfo.location||raw.location||"—"]].map(([l,v])=>(
                  <div key={l} style={{gridColumn:l==="Email"||l==="Business Address"?"span 2":"auto"}}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:"2px"}}>{l}</div>
                    <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{v}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Delivery Location */}
            <Card style={{marginBottom:"14px",padding:0,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.gray100}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <span style={{fontSize:"16px"}}>{isDelivery?"🚛":"🏭"}</span>
                  <div>
                    <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{isDelivery?"Delivery Location":"Self Pick-up"}</div>
                    <div style={{fontSize:"10px",color:T.gray400,marginTop:"1px"}}>{isDelivery?"Trucks dispatch to this address":"Buyer collects from your depot"}</div>
                  </div>
                </div>
                <span style={{
                  fontSize:"9px",fontWeight:800,padding:"3px 8px",
                  background:isDelivery?T.blueLight:T.amberLight,
                  color:isDelivery?T.blue:"#8A5C00",
                  flexShrink:0,
                }}>
                  {isDelivery?"DELIVERY":"PICK-UP"}
                </span>
              </div>

              {isDelivery&&delivery?.state?(
                <div>
                  {/* Address breakdown */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:`1px solid ${T.gray100}`}}>
                    <div style={{padding:"12px 16px",borderRight:`1px solid ${T.gray100}`}}>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>State</div>
                      <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{delivery.state}</div>
                    </div>
                    <div style={{padding:"12px 16px"}}>
                      <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>LGA</div>
                      <div style={{fontSize:"13px",fontWeight:800,color:T.black}}>{delivery.lga}</div>
                    </div>
                  </div>
                  <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.gray100}`}}>
                    <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>Street Address</div>
                    <div style={{fontSize:"13px",fontWeight:700,color:T.black,lineHeight:1.4}}>{delivery.address}</div>
                  </div>
                  <div style={{padding:"10px 16px",background:T.gray50,display:"flex",alignItems:"center",gap:"6px"}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.gray400} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span style={{fontSize:"11px",color:T.gray400,fontWeight:600}}>Est. transit time from depot: {meta.depot?.eta||"4–6h"}</span>
                  </div>
                </div>
              ):isDelivery?(
                /* delivery mode but no structured address in meta — show raw location */
                <div style={{padding:"14px 16px"}}>
                  <div style={{fontSize:"9px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>Delivery Address</div>
                  <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>{buyerInfo.location||raw.location||"Not specified"}</div>
                </div>
              ):(
                /* self pick-up */
                <div style={{padding:"14px 16px"}}>
                  <div style={{fontSize:"11px",color:T.gray600,lineHeight:1.5,marginBottom:"10px"}}>
                    The buyer will arrive at your depot with their own tanker trucks. Ensure loading bays are available and gate clearance is issued.
                  </div>
                  <div style={{background:T.amberLight,padding:"9px 12px",fontSize:"10px",color:"#8A5C00",fontWeight:700}}>
                    ⚠ Verify buyer's truck plates at gate before loading begins.
                  </div>
                </div>
              )}
            </Card>

            {/* Order Specs */}
            <Card style={{marginBottom:"14px"}}>
              <SectionHead title="Order Specifications"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 20px",marginBottom:isMultiDepot?"14px":"0"}}>
                {[
                  ...(!isMultiDepot?[
                    ["Product",<span style={{background:T.black,color:T.white,fontSize:"11px",fontWeight:800,padding:"2px 8px"}}>{meta.product||raw.product}</span>],
                    ["Volume",`${((meta.vol||raw.vol)/1000).toFixed(0)}k Litres`],
                    ["Price / Litre",`₦${(meta.pricePerLitre||0).toLocaleString()}`],
                  ]:[]),
                  ["Trucks",`${meta.trucks||raw.trucks} trucks`],
                  ["Loading Bay",bay||"Pending"],
                  [isDelivery?"Deliver To":"Mode", isDelivery?(delivery?.lga&&delivery?.state?`${delivery.lga}, ${delivery.state}`:(buyerInfo.location||raw.location||"—")):"Self Pick-up"],
                ].map(([l,v])=>(
                  <div key={l}>
                    <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:"2px"}}>{l}</div>
                    <div style={{fontSize:"13px",fontWeight:700,color:T.black}}>{v}</div>
                  </div>
                ))}
              </div>
              {isMultiDepot&&(
                <div>
                  <div style={{fontSize:"10px",fontWeight:700,color:T.gray400,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"8px"}}>Products Breakdown</div>
                  <div style={{border:`1px solid ${T.gray100}`}}>
                    {meta.products.map((p,i)=>(
                      <div key={p.name} style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr 1fr",alignItems:"center",padding:"9px 12px",gap:"10px",borderTop:i>0?`1px solid ${T.gray100}`:"none"}}>
                        <span style={{background:T.black,color:T.white,fontSize:"10px",fontWeight:800,padding:"2px 8px"}}>{p.name}</span>
                        <div>
                          <div style={{fontSize:"9px",color:T.gray400,fontWeight:600,textTransform:"uppercase"}}>Volume</div>
                          <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>{(p.vol/1000).toFixed(0)}k L</div>
                        </div>
                        <div>
                          <div style={{fontSize:"9px",color:T.gray400,fontWeight:600,textTransform:"uppercase"}}>Price/L</div>
                          <div style={{fontSize:"12px",fontWeight:700,color:T.black}}>₦{p.pricePerLitre?.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{fontSize:"9px",color:T.gray400,fontWeight:600,textTransform:"uppercase"}}>Value</div>
                          <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{fmtMoney(p.value)}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{padding:"9px 12px",borderTop:`2px solid ${T.black}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:T.gray50}}>
                      <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>Total · {(meta.vol/1000).toFixed(0)}k L</span>
                      <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>{fmtMoney(finials.productValue)}</span>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Pickup: Gate Record Summary */}
            {isPickup&&localStatus==="collected"&&buyerTrucks.some(t=>t.plate)&&(
              <Card style={{marginBottom:"14px"}}>
                <SectionHead title="Gate Record" sub={`${buyerTrucks.length} truck${buyerTrucks.length!==1?"s":""} collected · ${(buyerTruckVolTotal/1000).toFixed(0)}k L`}/>
                {buyerTrucks.filter(t=>t.plate).map((t,i)=>(
                  <div key={i} style={{paddingTop:i>0?"10px":"0",marginTop:i>0?"10px":"0",borderTop:i>0?`1px solid ${T.gray100}`:"none",display:"flex",alignItems:"center",gap:"10px"}}>
                    <div style={{width:"32px",height:"32px",background:T.greenLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",flexShrink:0}}>🏭</div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"2px"}}>
                        <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>{t.plate}</span>
                        <span style={{background:T.greenLight,color:T.greenDark,fontSize:"9px",fontWeight:800,padding:"1px 6px"}}>COLLECTED</span>
                      </div>
                      <div style={{fontSize:"11px",color:T.gray600}}>{t.driver||"Driver not recorded"} · {(parseInt(t.vol)||0).toLocaleString()} L</div>
                    </div>
                  </div>
                ))}
                {waybillRef&&(
                  <div style={{marginTop:"10px",paddingTop:"10px",borderTop:`1px solid ${T.gray100}`,display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:"11px",color:T.gray400,fontWeight:600}}>Waybill Ref</span>
                    <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>{waybillRef}</span>
                  </div>
                )}
              </Card>
            )}

            {/* Truck Management — delivery only */}
            {truckList.length>0&&!isPickup&&(
              <Card>
                <SectionHead title="Truck Status" sub={`${truckList.length} trucks · ${((meta.vol||raw.vol)/1000).toFixed(0)}k L`}/>
                {truckList.map((t,i)=>{
                  const isDelivered=t.status==="delivered";
                  const isInTransit=(localStatus==="in_transit"||dispatched)&&!isDelivered;
                  return (
                    <div key={t.id} style={{paddingTop:i>0?"12px":"0",marginTop:i>0?"12px":"0",borderTop:i>0?`1px solid ${T.gray100}`:"none",display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
                      <div style={{width:"32px",height:"32px",background:isDelivered?T.greenLight:isInTransit?T.blueLight:T.gray100,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",flexShrink:0}}>🚛</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"2px",flexWrap:"wrap"}}>
                          <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>Truck {i+1}</span>
                          <Badge status={isDelivered?"delivered":localStatus==="loading"?"loading":"in_transit"}/>
                          <span style={{fontSize:"10px",color:T.gray400}}>{t.plate==="TBD"?"—":t.plate}</span>
                        </div>
                        <div style={{fontSize:"11px",color:T.gray600}}>{t.driver==="TBD"?"Driver TBA":t.driver} · {(t.vol/1000).toFixed(0)}k L</div>
                        {isInTransit&&(
                          <div style={{marginTop:"5px"}}>
                            <div style={{height:"4px",background:T.gray100,borderRadius:"2px",overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${t.progress||10}%`,background:T.blue,borderRadius:"2px"}}/>
                            </div>
                            <div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>{t.progress||10}% · ETA {t.eta}</div>
                          </div>
                        )}
                      </div>
                      <div style={{flexShrink:0}}>
                        {isDelivered?(
                          <span style={{fontSize:"11px",fontWeight:800,color:T.greenDark}}>✓</span>
                        ):isInTransit?(
                          <button onClick={()=>handleMarkTruckDelivered(i)} style={{background:T.green,color:T.white,border:"none",padding:"6px 12px",fontSize:"10px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"32px",whiteSpace:"nowrap"}}>Delivered ✓</button>
                        ):null}
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>

          {/* RIGHT: Status guide + quick actions */}
          <div>
            <Card style={{marginBottom:"14px"}}>
              <SectionHead title="Next Steps"/>
              {localStatus==="pending"&&<div style={{fontSize:"12px",color:T.gray600,lineHeight:1.7}}>Review the order details and either <strong>Confirm</strong> to accept or <strong>Reject</strong> to decline. You have <strong style={{color:T.red}}>{raw.slaLeft||"—"}</strong> to respond.</div>}
              {localStatus==="confirmed"&&<div style={{fontSize:"12px",color:T.gray600,lineHeight:1.7}}>Assign an available loading bay above. This moves the order to <strong>Loading</strong> status.</div>}
              {localStatus==="loading"&&<div style={{fontSize:"12px",color:T.gray600,lineHeight:1.7}}>Ensure all {meta.trucks||raw.trucks} trucks are loaded, then click <strong>Dispatch All Trucks</strong> to mark the order as <strong>In Transit</strong>.</div>}
              {(localStatus==="in_transit"||dispatched)&&<div style={{fontSize:"12px",color:T.gray600,lineHeight:1.7}}>Mark each truck as <strong>Delivered</strong> as they confirm delivery. When all trucks are marked, the order completes automatically.</div>}
              {localStatus==="delivered"&&<div style={{fontSize:"12px",color:T.gray600,lineHeight:1.7}}>Order complete. Net revenue of <strong style={{color:T.greenDark}}>{fmtMoney(finials.netToDepot)}</strong> has been credited to your account.</div>}
              {localStatus==="rejected"&&<div style={{fontSize:"12px",color:T.gray600,lineHeight:1.7}}>This order was rejected. No further action required.</div>}
            </Card>

            <Card>
              <SectionHead title="Financials"/>
              {[
                ["Order Value",fmtMoney(finials.productValue),null],
                ...(quoteStatus==="agreed"?[["Delivery Revenue",`+${fmtMoney(quoteRounds[quoteRounds.length-1]?.amount||0)}`,null]]:isDelivery?[["Delivery Cost","Pending","pending"]]:[] ),
                ["Platform Fee (1%)",`-${fmtMoney(finials.platformFee)}`,"sub"],
                ["VAT",`-${fmtMoney(finials.vat)}`,"sub"],
              ].map(([l,v,type])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${T.gray100}`,alignItems:"center"}}>
                  <span style={{fontSize:type==="sub"?"11px":"12px",color:type==="sub"?T.gray400:type==="pending"?T.gray400:T.gray600,fontWeight:type==="sub"?600:700}}>{l}</span>
                  <span style={{fontSize:type==="sub"?"11px":"12px",fontWeight:700,
                    color:type==="sub"?T.gray400:type==="pending"?T.gray400:l==="Delivery Revenue"?T.greenDark:T.gray800}}>{v}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0 0"}}>
                <span style={{fontSize:"13px",fontWeight:800,color:T.black}}>Net to Depot</span>
                <span style={{fontSize:"15px",fontWeight:800,color:T.greenDark}}>
                  {fmtMoney((finials.netToDepot||0)+(quoteStatus==="agreed"?quoteRounds[quoteRounds.length-1]?.amount||0:0))}
                </span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB: TIMELINE ── */}
      {activeTab==="timeline"&&(
        <Card>
          <SectionHead title="Order Timeline"/>
          {timeline.map((e,i)=>(
            <div key={i} style={{display:"flex",gap:"10px",paddingBottom:i<timeline.length-1?"14px":"0",position:"relative"}}>
              {i<timeline.length-1&&<div style={{position:"absolute",left:"11px",top:"22px",bottom:0,width:"2px",background:T.gray100}}/>}
              <div style={{width:"22px",height:"22px",borderRadius:"50%",background:e.actor==="buyer"?T.blueLight:e.actor==="depot"?T.greenLight:T.gray100,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px",flexShrink:0,zIndex:1,color:e.actor==="buyer"?T.blue:e.actor==="depot"?T.greenDark:T.gray400,fontWeight:800}}>
                {e.actor==="buyer"?"B":e.actor==="depot"?"D":"S"}
              </div>
              <div style={{flex:1,paddingTop:"2px"}}>
                <div style={{fontSize:"12px",fontWeight:700,color:T.black,lineHeight:1.4}}>{e.event}</div>
                <div style={{fontSize:"10px",color:T.gray400,marginTop:"2px"}}>{e.time}</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* ── TAB: FINANCIALS ── */}
      {activeTab==="financials"&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"14px"}}>
          <Card>
            <SectionHead title="Revenue Breakdown"/>
            {[
              ["Gross Order Value",fmtMoney(finials.productValue),null],
              ...(quoteStatus==="agreed"?[["Delivery Revenue",`+${fmtMoney(quoteRounds[quoteRounds.length-1]?.amount||0)}`,null]]:isDelivery?[["Delivery Cost","Pending negotiation","pending"]]:[] ),
              ["Platform Fee (1%)",`-${fmtMoney(finials.platformFee)}`,"sub"],
              ["VAT (7.5%)",`-${fmtMoney(finials.vat)}`,"sub"],
            ].map(([l,v,type])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${T.gray100}`}}>
                <span style={{fontSize:"12px",color:type==="sub"?T.gray400:type==="pending"?T.gray400:T.gray600,fontWeight:type?600:700}}>{l}</span>
                <span style={{fontSize:"12px",fontWeight:800,
                  color:type==="sub"?T.gray400:type==="pending"?T.gray400:l==="Delivery Revenue"?T.greenDark:T.black}}>{v}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 0 0"}}>
              <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>Net to Depot</span>
              <span style={{fontSize:"16px",fontWeight:800,color:T.greenDark}}>
                {fmtMoney((finials.netToDepot||0)+(quoteStatus==="agreed"?quoteRounds[quoteRounds.length-1]?.amount||0:0))}
              </span>
            </div>
          </Card>
          <Card>
            <SectionHead title="Payment Status"/>
            <div style={{display:"grid",gap:"10px"}}>
              {[["Status",finials.paymentStatus==="paid"?"Completed":finials.paymentStatus==="processing"?"Processing":"Pending"],["Order Value",fmtMoney(finials.productValue)],["Method","Ventryl Pay"],["Ref",raw.id]].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.gray100}`}}>
                  <span style={{fontSize:"11px",color:T.gray400,fontWeight:600}}>{l}</span>
                  <span style={{fontSize:"12px",fontWeight:700,color:l==="Status"&&finials.paymentStatus==="paid"?T.greenDark:T.black}}>{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   UNIFIED DASHBOARD
════════════════════════════════════════════ */
/* ════════════════════════════════════════════
   MESSAGE MODAL (shared — buyer↔depot)
════════════════════════════════════════════ */
function UnifiedDash({depots,onOrder,onDepotClick,onNewDepot,onViewOrder,isMobile}) {
  const {buyerOrders,walletNGN,priceHistory,depotOrders}=useVentrylStore();
  const allOrders=[..._placedOrdersStore.slice().reverse(),...buyerOrders.filter(o=>!_placedOrdersStore.find(p=>p.id===o.id))];
  const verified=depots.filter(d=>d.kyb==="verified");
  const pending=depots.filter(d=>d.kyb!=="verified");
  const hasInbox=verified.length>0;
  const chartData=priceHistory.length?priceHistory:PRICE_HISTORY;
  // Aggregate real pending orders across all verified depots
  const allDepotIncoming=verified.flatMap(d=>depotOrders[d.id]||[]);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>

      {/* ── Hero ── */}
      <div style={{background:T.black,padding:isMobile?"16px":"22px 28px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:isMobile?"17px":"20px",fontWeight:800,color:T.white,marginBottom:"2px"}}>Good morning, Emeka</div>
            <div style={{fontSize:"11px",color:"#666"}}>Chukwuma Fuels Ltd · Lagos · KYB verified</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:"10px",fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"2px"}}>Wallet</div>
              <div style={{fontSize:isMobile?"18px":"22px",fontWeight:800,color:T.green}}>{walletNGN?`₦${walletNGN.balanceNGN.toLocaleString('en-NG')}`:"—"}</div>
            </div>
            <button onClick={onOrder} style={{background:T.green,color:T.black,border:"none",padding:"10px 18px",fontSize:"12px",fontWeight:800,cursor:"pointer",fontFamily:F,minHeight:"40px",whiteSpace:"nowrap"}}>+ Place Order</button>
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:"1px",background:T.gray100,border:`1px solid ${T.gray100}`}}>
        {[
          {l:"Orders This Month",v:"7",sub:"3 delivered · 2 in transit"},
          {l:"Total Volume Bought",v:"363k L",sub:"₦280.5M spend"},
          {l:"Active Depots",v:`${verified.length||"—"}`,sub:pending.length>0?`${pending.length} awaiting KYB`:"All verified",alert:pending.length>0},
          {l:"Depot Revenue",v:verified.length>0?"₦218M":"—",sub:"Combined · last 30 days"},
        ].map(k=><KpiCard key={k.l} label={k.l} value={k.v} sub={k.sub} alert={k.alert}/>)}
      </div>

      {/* ── Main content: left col (Inbox + Orders) · right col (Market Prices) ── */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.4fr 1fr",gap:"14px",alignItems:"start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          {hasInbox&&(
            <OrderInboxPanel incoming={allDepotIncoming} isMobile={isMobile} depot={null} onViewOrder={onViewOrder}/>
          )}
          <Card>
            <SectionHead title="Recent Orders" sub={`${allOrders.length} orders`} right={<button onClick={()=>onViewOrder&&onViewOrder(allOrders[0]?.id)} style={{background:"none",border:"none",fontSize:"11px",fontWeight:700,color:T.gray400,cursor:"pointer",fontFamily:F,padding:0}}>View all →</button>}/>
            {allOrders.length===0&&<div style={{padding:"16px 0",fontSize:"12px",color:T.gray400,textAlign:"center"}}>No orders yet</div>}
            {allOrders.slice(0,5).map((o,i,arr)=>(
              <div key={o.id} onClick={()=>onViewOrder&&onViewOrder(o.id)}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:i<arr.length-1?`1px solid ${T.gray100}`:"none",gap:"8px",flexWrap:"wrap",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background=T.gray50}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div>
                  <div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{o.id}</div>
                  <div style={{fontSize:"11px",color:T.gray400,marginTop:"2px"}}>{o.depot} · {o.product} · {(o.vol/1000).toFixed(0)}k L</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <span style={{fontSize:"12px",fontWeight:800,color:T.black}}>₦{(o.value/1e6).toFixed(1)}M</span>
                  <Badge status={_orderStatusStore[o.id]||o.status}/>
                </div>
              </div>
            ))}
          </Card>
        </div>
        <MarketPulseWidget onOrder={onOrder}/>
      </div>

    </div>
  );
}

/* ════════════════════════════════════════════
   PLATFORM SIDEBAR
════════════════════════════════════════════ */
function PlatformSidebar({activeView,setActiveView,depots,onNewDepot,identity,isMobile,onSignOut,isAdmin}) {
  const ITEMS=[
    {id:"dash",label:"Dashboard",icon:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"},
    {id:"market",label:"Price Discovery",icon:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"},
    {id:"order_form",label:"Place Order",icon:"M12 4v16m8-8H4"},
    {id:"orders",label:"My Orders",icon:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"},
    {id:"wallet",label:"Wallet",icon:"M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"},
    ...(isAdmin?[{id:"admin",label:"Admin Panel",icon:"M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",adminBadge:true}]:[]),
  ];
  const GEAR="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z";
  const pendingKyb=depots.filter(d=>d.kyb!=="verified").length;
  if (isMobile) {
    const MOB=[
      {id:"dash",label:"Home",icon:ITEMS[0].icon},
      {id:"market",label:"Market",icon:ITEMS[1].icon},
      {id:"order_form",label:"Order",icon:ITEMS[2].icon},
      {id:"orders",label:"Orders",icon:ITEMS[3].icon},
      {id:"__depots__",label:"Depots",icon:"M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",badge:pendingKyb||null},
    ];
    const isDepotView=activeView?.startsWith("depot:");
    return (
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.black,borderTop:"1px solid #1A1A1A",display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
        {MOB.map(n=>{
          const active=n.id==="__depots__"?isDepotView:activeView===n.id;
          return (
            <button key={n.id} onClick={()=>setActiveView(n.id==="__depots__"?(depots[0]?`depot:${depots[0].id}`:"dash"):n.id)}
              style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 4px",background:"none",border:"none",cursor:"pointer",fontFamily:F,color:active?T.green:"#555",position:"relative",minHeight:"56px"}}>
              {n.badge&&<span style={{position:"absolute",top:"6px",right:"calc(50% - 14px)",background:T.amber,color:T.black,fontSize:"9px",fontWeight:800,padding:"1px 4px",borderRadius:"8px",minWidth:"16px",textAlign:"center"}}>{n.badge}</span>}
              <Icon d={n.icon} size={20}/>
              <span style={{fontSize:"9px",fontWeight:700,marginTop:"3px",textTransform:"uppercase",letterSpacing:"0.04em"}}>{n.label}</span>
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div style={{width:"220px",background:T.black,minHeight:"100vh",display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh",overflowY:"auto"}}>
      <div style={{padding:"22px 20px 18px",borderBottom:"1px solid #1A1A1A"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div style={{width:"30px",height:"30px",background:T.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:"14px",fontWeight:800,color:T.black}}>V</span>
          </div>
          <div>
            <div style={{fontSize:"14px",fontWeight:800,color:T.white}}>Ventryl</div>
            <div style={{fontSize:"9px",fontWeight:700,color:"#555",letterSpacing:"0.1em",textTransform:"uppercase"}}>Platform</div>
          </div>
        </div>
      </div>
      <nav style={{padding:"12px 10px",flex:1,overflowY:"auto"}}>
        {ITEMS.map(n=>{
          const active=activeView===n.id;
          return (
            <button key={n.id} onClick={()=>setActiveView(n.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:"9px",padding:"9px 12px",borderRadius:"5px",background:active?T.white:"transparent",color:active?T.black:"#888",border:"none",cursor:"pointer",marginBottom:"2px",fontFamily:F,fontSize:"12px",fontWeight:active?800:600,textAlign:"left",transition:"all 0.1s"}}>
              <Icon d={n.icon} size={15}/>
              <span style={{flex:1}}>{n.label}</span>
              {n.adminBadge&&<span style={{background:T.green,color:T.black,fontSize:"8px",fontWeight:800,padding:"1px 5px",borderRadius:"2px",flexShrink:0}}>ADMIN</span>}
            </button>
          );
        })}
        <div style={{padding:"14px 12px 6px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:"9px",fontWeight:800,color:"#444",textTransform:"uppercase",letterSpacing:"0.1em"}}>My Depots</span>
          {depots.length>0&&<span style={{fontSize:"9px",color:"#444",fontWeight:700}}>{depots.length}</span>}
        </div>
        {depots.map(d=>{
          const active=activeView===`depot:${d.id}`;
          return (
            <button key={d.id} onClick={()=>setActiveView(`depot:${d.id}`)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:"9px",padding:"9px 12px",borderRadius:"5px",background:active?T.white:"transparent",color:active?T.black:"#888",border:"none",cursor:"pointer",marginBottom:"2px",fontFamily:F,fontSize:"12px",fontWeight:active?800:600,textAlign:"left",transition:"all 0.1s"}}>
              <div style={{width:"20px",height:"20px",background:active?T.black:d.kyb==="verified"?T.green:"#333",borderRadius:"4px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px",fontWeight:800,color:T.white,flexShrink:0}}>{d.name[0]}</div>
              <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</span>
              {d.kyb!=="verified"&&<span style={{background:T.amberLight,color:"#8A5C00",fontSize:"8px",fontWeight:800,padding:"1px 4px",borderRadius:"2px",flexShrink:0}}>KYB</span>}
            </button>
          );
        })}
        <button onClick={onNewDepot}
          style={{width:"100%",display:"flex",alignItems:"center",gap:"9px",padding:"9px 12px",background:"transparent",color:"#555",border:"1px dashed #2A2A2A",cursor:"pointer",marginTop:"4px",marginBottom:"2px",fontFamily:F,fontSize:"11px",fontWeight:600,textAlign:"left",borderRadius:"5px"}}>
          <span style={{fontSize:"16px",lineHeight:1,flexShrink:0}}>+</span>New Depot
        </button>
        <div style={{height:"1px",background:"#1A1A1A",margin:"12px 0"}}/>
        {(()=>{const active=activeView==="settings";return(
          <button onClick={()=>setActiveView("settings")}
            style={{width:"100%",display:"flex",alignItems:"center",gap:"9px",padding:"9px 12px",borderRadius:"5px",background:active?T.white:"transparent",color:active?T.black:"#888",border:"none",cursor:"pointer",marginBottom:"2px",fontFamily:F,fontSize:"12px",fontWeight:active?800:600,textAlign:"left",transition:"all 0.1s"}}>
            <Icon d={GEAR} size={15}/><span>Settings</span>
          </button>
        );})()}
      </nav>
      <div style={{padding:"14px 20px",borderTop:"1px solid #1A1A1A"}}>
        <div style={{display:"flex",alignItems:"center",gap:"9px",marginBottom:onSignOut?"10px":"0"}}>
          <div style={{width:"30px",height:"30px",background:identity.bg||T.green,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:800,color:identity.textColor||T.black,flexShrink:0}}>{identity.initials||"?"}</div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:"11px",fontWeight:800,color:T.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{identity.name||""}</div>
            <div style={{fontSize:"10px",color:"#555"}}>{identity.role||""}</div>
            {identity.vcs&&<div style={{fontSize:"9px",fontWeight:800,color:identity.vcs>=750?T.green:identity.vcs>=500?"#d97706":"#888",marginTop:"1px"}}>VCS {identity.vcs}</div>}
          </div>
        </div>
        {identity.isAdmin&&<div style={{background:"#0A2A0A",color:T.green,fontSize:"9px",fontWeight:800,padding:"4px 8px",textAlign:"center",letterSpacing:"0.08em",marginBottom:"6px"}}>ADMIN ACCESS</div>}
        {onSignOut&&(
          <button onClick={onSignOut} style={{width:"100%",padding:"8px",background:"transparent",border:"1px solid #2A2A2A",color:"#666",fontFamily:F,fontSize:"11px",fontWeight:700,cursor:"pointer",textAlign:"center",letterSpacing:"0.04em"}}>
            Sign Out
          </button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   VENTRYL PLATFORM
════════════════════════════════════════════ */
function VentrylPlatform({bp, user, onSignOut}) {
  const {isMobile}=bp;
  const {user:authUser,profile:authProfile}=useAuthStore();
  const {ownerDepots,ownerDepotsLoaded,loadOwnerDepots,buyerOrders,buyerOrdersLoaded,loadBuyerOrders,priceHistory,loadPriceHistory}=useVentrylStore();
  const [activeView,setActiveView]=useState("dash");
  const [creatingDepot,setCreatingDepot]=useState(false);
  const [showKycGate,setShowKycGate]=useState(false);

  // Load real data on mount
  useEffect(()=>{
    if(!authUser?.id) return;
    if(!ownerDepotsLoaded) loadOwnerDepots(authUser.id);
    if(!buyerOrdersLoaded) loadBuyerOrders(authUser.id);
    loadPriceHistory(7);
  },[authUser?.id]);

  // Merge DB depots with any locally created ones (pending DB round-trip)
  const [localDepots,setLocalDepots]=useState([]);
  const depots=[...ownerDepots,...localDepots.filter(ld=>!ownerDepots.find(d=>d.id===ld.id))];

  const handleNewDepot=()=>{
    if(authProfile?.kyc_status!=="verified"){setShowKycGate(true);return;}
    setCreatingDepot(true);
  };
  const handleCreateDepot=async(form)=>{
    // Create in DB; returns the newly created depot row (with id)
    const created=await depotsApi.create({
      ownerId:authUser.id,name:form.name,location:form.location,
      state:form.state,lga:form.lga||form.location,
      address:form.address,licenseNumber:form.license,licenseExpiry:form.expiry,
      capacity:Number(form.capacity)||0,products:form.products,
      contactName:form.contactName,contactPhone:form.contactPhone,
      contactEmail:form.contactEmail,contactRole:form.contactRole,
    });
    // Add optimistic entry while we reload
    const optimistic={id:created.id,name:form.name,location:form.location,kyb:"pending",license:form.license,capacity:Number(form.capacity)||0,products:form.products.map(n=>({id:n.toLowerCase()+"_"+created.id,name:n,pricePerLitre:0,stock:0,threshold:5000})),stockHistory:[]};
    setLocalDepots(prev=>[...prev,optimistic]);
    loadOwnerDepots(authUser.id); // background refresh
    return created; // caller uses the id for KYB uploads
  };
  const handleUpdateDepot=(depotId,patch)=>{
    // Update local depots state so UI reflects immediately
    setLocalDepots(prev=>prev.map(d=>d.id===depotId?{...d,...patch}:d));
    // Also refresh from DB to get server truth
    if(authUser?.id) loadOwnerDepots(authUser.id);
  };

  const [navHistory,setNavHistory]=useState([]);
  const navigate=(v)=>{
    setNavHistory(h=>[...h,activeView]);
    setActiveView(v);
    setCreatingDepot(false);
  };
  const goBack=()=>{
    setNavHistory(h=>{
      if(h.length===0){setActiveView("dash");return h;}
      const prev=h[h.length-1];
      setActiveView(prev);
      setCreatingDepot(false);
      return h.slice(0,-1);
    });
  };
  const activeDepot=activeView?.startsWith("depot:")?depots.find(d=>d.id===activeView.replace("depot:","")):null;
  const getCrumb=()=>{
    if(creatingDepot)return "New Depot";
    if(activeView?.startsWith("depot_order:")){
      const parts=activeView.split(":");
      const depot=depots.find(d=>d.id===parts[2]);
      return `${depot?.name||"Depot"} · ${parts[1]}`;
    }
    if(activeDepot)return activeDepot.name;
    if(activeView?.startsWith("order:"))return activeView.replace("order:","");
    return {dash:"Dashboard",market:"Price Discovery",order_form:"Place Order",orders:"My Orders",wallet:"Wallet",settings:"Settings"}[activeView]||"Dashboard";
  };

  const ALL_BUYER_ORDERS=[..._placedOrdersStore.slice().reverse(),...buyerOrders.filter(o=>!_placedOrdersStore.find(p=>p.id===o.id))];
  const ORDERS_VIEW=(
    <div>
      <div style={{fontSize:"14px",fontWeight:800,color:T.black,marginBottom:"14px"}}>My Orders</div>
      {isMobile?(
        ALL_BUYER_ORDERS.map((o,i)=>(
          <div key={o.id} onClick={()=>navigate(`order:${o.id}`)} style={{border:`1px solid ${T.gray100}`,background:T.white,padding:"14px 16px",marginBottom:"8px",cursor:"pointer"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.black} onMouseLeave={e=>e.currentTarget.style.borderColor=T.gray100}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"7px"}}>
              <div><div style={{fontSize:"12px",fontWeight:800,color:T.black}}>{o.id}</div><div style={{fontSize:"11px",color:T.gray400,marginTop:"1px"}}>{o.depot} · {o.product}</div></div>
              <Badge status={o.status}/>
            </div>
            <div style={{display:"flex",gap:"14px"}}>
              <span style={{fontSize:"11px",color:T.gray600,fontWeight:700}}>{(o.vol/1000).toFixed(0)}k L</span>
              <span style={{fontSize:"11px",fontWeight:800,color:T.black}}>₦{(o.value/1e6).toFixed(1)}M</span>
              <span style={{fontSize:"11px",color:T.gray400}}>{o.placed}</span>
            </div>
          </div>
        ))
      ):(
        <Card pad={false}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${T.gray100}`}}>{["Order","Depot","Product","Volume","Trucks","Value","Placed","Status"].map(h=><th key={h} style={{padding:"10px 18px",fontFamily:F,fontSize:"10px",fontWeight:700,color:T.gray400,textAlign:"left",textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>)}</tr></thead>
            <tbody>{ALL_BUYER_ORDERS.map((o,i)=>(
              <tr key={o.id} onClick={()=>navigate(`order:${o.id}`)} style={{borderBottom:i<ALL_BUYER_ORDERS.length-1?`1px solid ${T.gray100}`:"none",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#F6F6F6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"12px",fontWeight:800,color:T.black}}>{o.id}</td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"12px",color:T.gray800}}>{o.depot}</td>
                <td style={{padding:"13px 18px"}}><span style={{background:T.gray100,color:T.black,fontSize:"10px",fontWeight:800,padding:"3px 7px"}}>{o.product}</span></td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"12px",color:T.gray600}}>{(o.vol/1000).toFixed(0)}k L</td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"12px",fontWeight:700,color:T.black,textAlign:"center"}}>{o.trucks}</td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"13px",fontWeight:800,color:T.black}}>₦{(o.value/1e6).toFixed(1)}M</td>
                <td style={{padding:"13px 18px",fontFamily:F,fontSize:"11px",color:T.gray400}}>{o.placed}</td>
                <td style={{padding:"13px 18px"}}><Badge status={_orderStatusStore[o.id]||o.status}/></td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </div>
  );

  const KYC_GATE_MODAL=showKycGate&&(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{background:T.white,maxWidth:"420px",width:"100%",padding:"28px",fontFamily:F}}>
        <div style={{width:"44px",height:"44px",background:T.amberLight,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"16px",fontSize:"20px"}}>🔒</div>
        <div style={{fontSize:"16px",fontWeight:800,color:T.black,marginBottom:"8px"}}>KYC Verification Required</div>
        <div style={{fontSize:"13px",color:"#555",lineHeight:1.6,marginBottom:"20px"}}>
          You need to complete identity verification (KYC) before creating a depot.<br/><br/>
          Go to <strong>Settings → Verification</strong> to upload your documents and submit for review.
        </div>
        <div style={{display:"flex",gap:"10px"}}>
          <button onClick={()=>{setShowKycGate(false);navigate("settings");}}
            style={{flex:1,background:T.black,color:T.white,border:"none",padding:"12px",fontSize:"13px",fontWeight:800,cursor:"pointer",fontFamily:F}}>
            Go to Verification →
          </button>
          <button onClick={()=>setShowKycGate(false)}
            style={{flex:"0 0 auto",background:T.white,color:T.gray600,border:`1px solid ${T.gray200}`,padding:"12px 16px",fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:F}}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
  const renderView=()=>{
    if(creatingDepot)return <CreateDepotFlow onCreateDepot={handleCreateDepot} onDone={(id)=>{setCreatingDepot(false);if(id)setActiveView(`depot:${id}`);}} onCancel={()=>setCreatingDepot(false)} isMobile={isMobile}/>;
    // depot_order:VTL-XXXXX:depotId — always handle first, regardless of activeDepot
    if(activeView.startsWith("depot_order:")){
      const parts=activeView.split(":");
      const orderId=parts[1];
      const depotId=parts[2];
      const depot=depots.find(d=>d.id===depotId)||activeDepot||depots[0];
      return <DepotOrderDetail orderId={orderId} depot={depot} onBack={goBack} onUpdateDepot={handleUpdateDepot} isMobile={isMobile}/>;
    }
    if(activeDepot){
      return <DepotDetailView depot={activeDepot} onUpdateDepot={handleUpdateDepot} onViewOrder={id=>navigate(`depot_order:${id}:${activeDepot.id}`)} isMobile={isMobile}/>;
    }
    // order:VTL-XXXXX — buyer tracking view
    if(activeView.startsWith("order:")){
      const orderId=activeView.replace("order:","");
      return <BuyerOrderDetail orderId={orderId} onBack={goBack} isMobile={isMobile}/>;
    }
    if(activeView==="admin") return <AdminPanel isMobile={isMobile}/>;
    const map={
      dash:<UnifiedDash depots={depots} onOrder={()=>navigate("order_form")} onDepotClick={id=>navigate(`depot:${id}`)} onNewDepot={handleNewDepot} onViewOrder={id=>{
          // Check if the id belongs to a depot inbox order (not a buyer order)
          const allDepotOrderIds=Object.values(useVentrylStore.getState().depotOrders||{}).flat().map(o=>o.id);
          const isIncoming=INCOMING.some(o=>o.id===id)||allDepotOrderIds.includes(id);
          if(isIncoming){const d=depots.find(d=>d.kyb==="verified")||depots[0];if(d){navigate(`depot_order:${id}:${d.id}`);return;}}
          navigate(`order:${id}`);
        }} isMobile={isMobile}/>,
      market:<BuyerMarketplace onOrder={()=>navigate("order_form")} isMobile={isMobile}/>,
      orders:ORDERS_VIEW,
      wallet:<BuyerWallet isMobile={isMobile}/>,
      order_form:<OrderFlow onDone={()=>navigate("dash")} isMobile={isMobile}/>,
      settings:<SettingsModule portalType="buyer" isMobile={isMobile}/>,
    };
    return map[activeView]||map.dash;
  };

  const isAdmin=!!user?.isAdmin;
  const pendingKyb=depots.filter(d=>d.kyb!=="verified").length;
  const pills=[
    {bg:T.greenLight,color:T.greenDark,label:"KYB ✓"},
    {bg:T.gray50,color:T.black,label:"₦25.8M"},
    pendingKyb?{bg:T.amberLight,color:"#8A5C00",label:`${pendingKyb} KYB pending`}:{bg:T.gray50,color:T.black,label:`${depots.length} depot${depots.length!==1?"s":""}`},
  ];

  const IDENTITY=user||{initials:"EC",bg:T.green,textColor:T.black,name:"Emeka Chukwuma",role:"Account Owner"};
  return (
    <div style={{display:"flex",minHeight:"100vh",fontFamily:F}}>
      {KYC_GATE_MODAL}
      <PlatformSidebar activeView={activeView} setActiveView={navigate} depots={depots} onNewDepot={handleNewDepot} identity={IDENTITY} isMobile={isMobile} onSignOut={onSignOut} isAdmin={isAdmin}/>
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column"}}>
        <Topbar crumb={getCrumb()} isMobile={isMobile} portalLabel="Platform" pills={pills}/>
        <div style={{padding:isMobile?"14px 16px":"24px 28px",paddingBottom:isMobile?"80px":"24px",flex:1,overflowY:"auto"}}>
          {renderView()}
        </div>
      </div>
      {isMobile&&<PlatformSidebar activeView={activeView} setActiveView={navigate} depots={depots} onNewDepot={handleNewDepot} identity={IDENTITY} isMobile={true} onSignOut={onSignOut} isAdmin={isAdmin}/>}
    </div>
  );
}

/* ════════════════════════════════════════════
   ROOT
════════════════════════════════════════════ */
const GLOBAL_STYLES=`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:#D3D3D3;} input[type=range]{-webkit-appearance:none;appearance:none;height:4px;background:#EBEBEB;border-radius:2px;outline:none;} input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;background:#000;border-radius:50%;cursor:pointer;} input[type=number]::-webkit-inner-spin-button{opacity:1;} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}`;

function LoadingScreen() {
  return (
    <div style={{minHeight:"100vh",background:T.black,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F}}>
      <style>{GLOBAL_STYLES}</style>
      <div style={{textAlign:"center"}}>
        <div style={{width:"40px",height:"40px",background:T.green,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
          <span style={{fontSize:"18px",fontWeight:800,color:T.black}}>V</span>
        </div>
        <div style={{fontSize:"12px",fontWeight:700,color:"#444",letterSpacing:"0.08em",textTransform:"uppercase"}}>Loading…</div>
      </div>
    </div>
  );
}

export default function VentrylApp() {
  const bp=useBreakpoint();
  const {session,profile,loading,init,signOut}=useAuthStore();

  useEffect(()=>{init();},[]);

  if(loading) return <LoadingScreen/>;

  if(!session) return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <AuthScreens/>
    </>
  );

  // Derive sidebar identity from real profile
  const initials=profile?.full_name
    ?profile.full_name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()
    :"?";
  const user={
    initials,
    bg:T.green,
    textColor:T.black,
    name:profile?.full_name||"",
    role:profile?.company_name||"",
    isAdmin:!!profile?.is_admin,
    vcs:profile?.vcs||300,
  };

  return (
    <div style={{fontFamily:F,background:T.gray50,minHeight:"100vh"}}>
      <style>{GLOBAL_STYLES}</style>
      <VentrylPlatform bp={bp} user={user} onSignOut={signOut}/>
    </div>
  );
}

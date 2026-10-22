"""
scripts/build_200_drugs.py

Builds and validates a full database of 200+ essential Indian medicines
comparing branded market prices against Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBJP) / NPPA prices.
"""

import json
from pathlib import Path
from validate_and_normalize import process_dataset

# Import existing 106 records from curate_dataset
from curate_dataset import DRUGS as EXISTING_106

ADDITIONAL_DRUGS = [
    # --- NSAIDs & Pain Relief ---
    {
        "id": "etoricoxib-60mg-tab",
        "brand_name": "Nucoxia 60",
        "molecule": "Etoricoxib",
        "strength": "60 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 110.00,
        "generic_price": 18.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["nucoxia 60", "arcoxia 60", "etoshine 60", "न्यूकोक्सिया 60"]
    },
    {
        "id": "etoricoxib-90mg-tab",
        "brand_name": "Nucoxia 90",
        "molecule": "Etoricoxib",
        "strength": "90 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 145.00,
        "generic_price": 22.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["nucoxia 90", "arcoxia 90", "etoshine 90", "न्यूकोक्सिया 90"]
    },
    {
        "id": "etoricoxib-120mg-tab",
        "brand_name": "Nucoxia 120",
        "molecule": "Etoricoxib",
        "strength": "120 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 195.00,
        "generic_price": 28.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["nucoxia 120", "arcoxia 120", "etoshine 120"]
    },
    {
        "id": "naproxen-500mg-tab",
        "brand_name": "Naprosyn 500",
        "molecule": "Naproxen",
        "strength": "500 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 85.00,
        "generic_price": 14.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["naprosyn 500", "xenobid 500", "नेप्रोसीन"]
    },
    {
        "id": "piroxicam-20mg-cap",
        "brand_name": "Dolonex 20",
        "molecule": "Piroxicam",
        "strength": "20 mg",
        "unit": "strip of 10 capsules",
        "branded_price": 78.00,
        "generic_price": 9.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["dolonex 20", "pirox 20", "डोलोनेक्स"]
    },
    {
        "id": "ketorolac-10mg-dt-tab",
        "brand_name": "Ketorol-DT 10",
        "molecule": "Ketorolac Tromethamine",
        "strength": "10 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 55.00,
        "generic_price": 8.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["ketorol dt", "ketanov dt", "कीटोरोल"]
    },

    # --- Gastrointestinal, Antispasmodics & Antiemetics ---
    {
        "id": "domperidone-10mg-tab",
        "brand_name": "Domstal 10",
        "molecule": "Domperidone",
        "strength": "10 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 42.00,
        "generic_price": 6.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["domstal 10", "motinorm 10", "vomistop 10", "डोमस्टाल"]
    },
    {
        "id": "rabeprazole-levosulpiride-cap",
        "brand_name": "Razo-L",
        "molecule": "Rabeprazole + Levosulpiride",
        "strength": "20 mg + 75 mg",
        "unit": "strip of 10 capsules",
        "branded_price": 240.00,
        "generic_price": 45.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["razo l", "rabicip l", "rabium plus"]
    },
    {
        "id": "pantoprazole-levosulpiride-cap",
        "brand_name": "Pan-L",
        "molecule": "Pantoprazole + Levosulpiride",
        "strength": "40 mg + 75 mg",
        "unit": "strip of 10 capsules",
        "branded_price": 250.00,
        "generic_price": 48.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["pan l", "pantocid l", "pantodac l"]
    },
    {
        "id": "dicyclomine-paracetamol-tab",
        "brand_name": "Spasmonil",
        "molecule": "Dicyclomine + Paracetamol",
        "strength": "20 mg + 325 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 48.00,
        "generic_price": 8.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["spasmonil", "cyclopam", "colimex", "स्पास्मोनिल"]
    },
    {
        "id": "drotaverine-40mg-tab",
        "brand_name": "Drotin 40",
        "molecule": "Drotaverine Hydrochloride",
        "strength": "40 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 95.00,
        "generic_price": 14.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["drotin 40", "drotaverine 40", "ड्रोटीन"]
    },
    {
        "id": "drotaverine-mefenamic-tab",
        "brand_name": "Drotin-M",
        "molecule": "Drotaverine + Mefenamic Acid",
        "strength": "80 mg + 250 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 165.00,
        "generic_price": 24.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["drotin m", "drotikind m", "ड्रोटीन एम"]
    },
    {
        "id": "loperamide-2mg-tab",
        "brand_name": "Imodium 2mg",
        "molecule": "Loperamide Hydrochloride",
        "strength": "2 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 28.00,
        "generic_price": 4.50,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["imodium", "lopamide", "eldoper", "इमोडियम"]
    },
    {
        "id": "racecadotril-100mg-cap",
        "brand_name": "Redotil 100",
        "molecule": "Racecadotril",
        "strength": "100 mg",
        "unit": "strip of 10 capsules",
        "branded_price": 160.00,
        "generic_price": 28.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["redotil 100", "zedott 100", "enuff 100"]
    },
    {
        "id": "ors-powder-sachet",
        "brand_name": "Electral Powder",
        "molecule": "Oral Rehydration Salts (WHO Formula)",
        "strength": "21.8 gm",
        "unit": "sachet of 21.8 gm",
        "branded_price": 22.00,
        "generic_price": 5.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["electral", "ors", "ors sachet", "इलेक्ट्रल"]
    },
    {
        "id": "lactulose-syrup-100ml",
        "brand_name": "Duphalac Syrup",
        "molecule": "Lactulose",
        "strength": "10 gm / 15 ml",
        "unit": "bottle of 100 ml",
        "branded_price": 185.00,
        "generic_price": 42.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["duphalac", "livotuk", "cremalax liquid"]
    },
    {
        "id": "chlordiazepoxide-clidinium-tab",
        "brand_name": "Librax",
        "molecule": "Chlordiazepoxide + Clidinium Bromide",
        "strength": "5 mg + 2.5 mg",
        "unit": "strip of 20 tablets",
        "branded_price": 165.00,
        "generic_price": 24.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["librax", "spasnil", "clindex"]
    },

    # --- Antibiotics & Anti-Infectives ---
    {
        "id": "cefuroxime-500mg-tab",
        "brand_name": "Ceftum 500",
        "molecule": "Cefuroxime Axetil",
        "strength": "500 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 420.00,
        "generic_price": 85.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["ceftum 500", "cetil 500", "forcef 500", "सेफ्टम 500"]
    },
    {
        "id": "cefuroxime-250mg-tab",
        "brand_name": "Ceftum 250",
        "molecule": "Cefuroxime Axetil",
        "strength": "250 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 240.00,
        "generic_price": 48.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["ceftum 250", "cetil 250", "forcef 250"]
    },
    {
        "id": "cefixime-ofloxacin-tab",
        "brand_name": "Taxim-O Plus",
        "molecule": "Cefixime + Ofloxacin",
        "strength": "200 mg + 200 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 210.00,
        "generic_price": 45.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["taxim o plus", "mahacef plus", "cefolac plus"]
    },
    {
        "id": "clindamycin-300mg-cap",
        "brand_name": "Dalacin C 300",
        "molecule": "Clindamycin Hydrochloride",
        "strength": "300 mg",
        "unit": "strip of 10 capsules",
        "branded_price": 280.00,
        "generic_price": 55.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["dalacin c 300", "clindex 300", "dalcap 300"]
    },
    {
        "id": "linezolid-600mg-tab",
        "brand_name": "Linid 600",
        "molecule": "Linezolid",
        "strength": "600 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 390.00,
        "generic_price": 68.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["linid 600", "lizomac 600", "zyvox 600"]
    },
    {
        "id": "nitrofurantoin-100mg-tab",
        "brand_name": "Martifur MR 100",
        "molecule": "Nitrofurantoin",
        "strength": "100 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 165.00,
        "generic_price": 28.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["martifur mr 100", "niftran 100", "furadantin"]
    },
    {
        "id": "faropenem-200mg-tab",
        "brand_name": "Farobact 200",
        "molecule": "Faropenem Sodium",
        "strength": "200 mg",
        "unit": "strip of 6 tablets",
        "branded_price": 580.00,
        "generic_price": 120.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["farobact 200", "farozet 200", "faronem 200"]
    },
    {
        "id": "terbinafine-250mg-tab",
        "brand_name": "Sebifin 250",
        "molecule": "Terbinafine Hydrochloride",
        "strength": "250 mg",
        "unit": "strip of 7 tablets",
        "branded_price": 195.00,
        "generic_price": 38.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["sebifin 250", "lamisil 250", "terbicip 250"]
    },
    {
        "id": "terbinafine-500mg-tab",
        "brand_name": "Sebifin 500",
        "molecule": "Terbinafine Hydrochloride",
        "strength": "500 mg",
        "unit": "strip of 7 tablets",
        "branded_price": 320.00,
        "generic_price": 65.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["sebifin 500", "terbicip 500"]
    },
    {
        "id": "acyclovir-400mg-tab",
        "brand_name": "Acivir 400",
        "molecule": "Acyclovir",
        "strength": "400 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 110.00,
        "generic_price": 22.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["acivir 400", "zovirax 400", "herpex 400"]
    },
    {
        "id": "oseltamivir-75mg-cap",
        "brand_name": "FluVir 75",
        "molecule": "Oseltamivir Phosphate",
        "strength": "75 mg",
        "unit": "strip of 10 capsules",
        "branded_price": 495.00,
        "generic_price": 110.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["fluvir 75", "tamiflu 75", "antiflu 75"]
    },

    # --- Cardiovascular & Antihypertensives ---
    {
        "id": "telmisartan-chlorthalidone-tab",
        "brand_name": "Telma-CT 40",
        "molecule": "Telmisartan + Chlorthalidone",
        "strength": "40 mg + 12.5 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 165.00,
        "generic_price": 24.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["telma ct 40", "telmikind ct", "telpres ct"]
    },
    {
        "id": "telmisartan-hctz-tab",
        "brand_name": "Telma-H",
        "molecule": "Telmisartan + Hydrochlorothiazide",
        "strength": "40 mg + 12.5 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 145.00,
        "generic_price": 22.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["telma h", "telmikind h", "telvas h", "टेलमा एच"]
    },
    {
        "id": "losartan-hctz-tab",
        "brand_name": "Losar-H",
        "molecule": "Losartan Potassium + Hydrochlorothiazide",
        "strength": "50 mg + 12.5 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 135.00,
        "generic_price": 20.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["losar h", "losakar h", "repace h", "लोसार एच"]
    },
    {
        "id": "cilnidipine-10mg-tab",
        "brand_name": "Cilacar 10",
        "molecule": "Cilnidipine",
        "strength": "10 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 115.00,
        "generic_price": 18.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["cilacar 10", "cilaheart 10", "cilnidac 10", "सिलाकार"]
    },
    {
        "id": "cilnidipine-20mg-tab",
        "brand_name": "Cilacar 20",
        "molecule": "Cilnidipine",
        "strength": "20 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 195.00,
        "generic_price": 28.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["cilacar 20", "cilaheart 20", "cilnidac 20"]
    },
    {
        "id": "nebivolol-5mg-tab",
        "brand_name": "Nebicard 5",
        "molecule": "Nebivolol",
        "strength": "5 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 145.00,
        "generic_price": 22.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["nebicard 5", "nebistol 5", "nebilong 5"]
    },
    {
        "id": "metoprolol-succinate-50-er-tab",
        "brand_name": "Metolar-XR 50",
        "molecule": "Metoprolol Succinate (Extended Release)",
        "strength": "50 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 165.00,
        "generic_price": 26.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["metolar xr 50", "betaloc xl 50", "revalmet 50"]
    },
    {
        "id": "ramipril-2-5mg-tab",
        "brand_name": "Cardace 2.5",
        "molecule": "Ramipril",
        "strength": "2.5 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 85.00,
        "generic_price": 11.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["cardace 2.5", "hopace 2.5", "ramirid 2.5"]
    },
    {
        "id": "bisoprolol-2-5mg-tab",
        "brand_name": "Concor 2.5",
        "molecule": "Bisoprolol Fumarate",
        "strength": "2.5 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 75.00,
        "generic_price": 10.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["concor 2.5", "corbis 2.5", "bisonext 2.5"]
    },
    {
        "id": "olmesartan-40mg-tab",
        "brand_name": "Olmecip 40",
        "molecule": "Olmesartan Medoxomil",
        "strength": "40 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 195.00,
        "generic_price": 28.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["olmecip 40", "olmax 40", "benicar 40"]
    },
    {
        "id": "diltiazem-30mg-tab",
        "brand_name": "Dilzem 30",
        "molecule": "Diltiazem Hydrochloride",
        "strength": "30 mg",
        "unit": "strip of 30 tablets",
        "branded_price": 62.00,
        "generic_price": 9.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["dilzem 30", "diltiaz 30", "दिलजेम"]
    },
    {
        "id": "diltiazem-60mg-tab",
        "brand_name": "Dilzem 60",
        "molecule": "Diltiazem Hydrochloride",
        "strength": "60 mg",
        "unit": "strip of 30 tablets",
        "branded_price": 98.00,
        "generic_price": 14.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["dilzem 60", "diltiaz 60"]
    },
    {
        "id": "verapamil-40mg-tab",
        "brand_name": "Calaptin 40",
        "molecule": "Verapamil Hydrochloride",
        "strength": "40 mg",
        "unit": "strip of 20 tablets",
        "branded_price": 45.00,
        "generic_price": 7.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["calaptin 40", "veramil 40", "कैलाप्टिन"]
    },
    {
        "id": "digoxin-0-25mg-tab",
        "brand_name": "Lanoxin 0.25",
        "molecule": "Digoxin",
        "strength": "0.25 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 22.00,
        "generic_price": 4.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["lanoxin", "dixin 0.25", "लैनेक्सिन"]
    },
    {
        "id": "isosorbide-mononitrate-30-sr-tab",
        "brand_name": "Monotrate 30",
        "molecule": "Isosorbide Mononitrate (Sustained Release)",
        "strength": "30 mg",
        "unit": "strip of 30 tablets",
        "branded_price": 85.00,
        "generic_price": 12.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["monotrate 30", "isimo 30", "monit 30"]
    },
    {
        "id": "clopidogrel-aspirin-tab",
        "brand_name": "Deplatt-A 75",
        "molecule": "Clopidogrel + Aspirin",
        "strength": "75 mg + 75 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 135.00,
        "generic_price": 22.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["deplatt a", "clopilet a", "plavix plus"]
    },
    {
        "id": "chlorthalidone-12-5mg-tab",
        "brand_name": "Thalizide 12.5",
        "molecule": "Chlorthalidone",
        "strength": "12.5 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 75.00,
        "generic_price": 11.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["thalizide 12.5", "hygroton 12.5"]
    },
    {
        "id": "torsemide-10mg-tab",
        "brand_name": "Dytor 10",
        "molecule": "Torsemide",
        "strength": "10 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 78.00,
        "generic_price": 12.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["dytor 10", "tide 10", "torlac 10", "डाइटोर"]
    },
    {
        "id": "torsemide-20mg-tab",
        "brand_name": "Dytor 20",
        "molecule": "Torsemide",
        "strength": "20 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 125.00,
        "generic_price": 18.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["dytor 20", "tide 20", "torlac 20"]
    },
    {
        "id": "torsemide-spironolactone-tab",
        "brand_name": "Dytor Plus 10",
        "molecule": "Torsemide + Spironolactone",
        "strength": "10 mg + 50 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 110.00,
        "generic_price": 18.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["dytor plus 10", "tide plus 10", "torlac plus"]
    },

    # --- Antidiabetics ---
    {
        "id": "metformin-850mg-tab",
        "brand_name": "Glycomet 850",
        "molecule": "Metformin Hydrochloride",
        "strength": "850 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 48.00,
        "generic_price": 9.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["glycomet 850", "obimet 850", "gluformin 850"]
    },
    {
        "id": "glimepiride-3mg-tab",
        "brand_name": "Amaryl 3mg",
        "molecule": "Glimepiride",
        "strength": "3 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 210.00,
        "generic_price": 19.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["amaryl 3", "zoryl 3", "glypride 3"]
    },
    {
        "id": "glimepiride-4mg-tab",
        "brand_name": "Amaryl 4mg",
        "molecule": "Glimepiride",
        "strength": "4 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 260.00,
        "generic_price": 24.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["amaryl 4", "zoryl 4", "glypride 4"]
    },
    {
        "id": "empagliflozin-10mg-tab",
        "brand_name": "Jardiance 10",
        "molecule": "Empagliflozin",
        "strength": "10 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 680.00,
        "generic_price": 62.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["jardiance 10", "empa 10", "empaglif 10", "जारडिएंस"]
    },
    {
        "id": "empagliflozin-25mg-tab",
        "brand_name": "Jardiance 25",
        "molecule": "Empagliflozin",
        "strength": "25 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 850.00,
        "generic_price": 85.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["jardiance 25", "empa 25", "empaglif 25"]
    },
    {
        "id": "empagliflozin-metformin-tab",
        "brand_name": "Jardiance Duo 12.5/500",
        "molecule": "Empagliflozin + Metformin",
        "strength": "12.5 mg + 500 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 790.00,
        "generic_price": 78.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["jardiance duo", "empa m"]
    },
    {
        "id": "dapagliflozin-metformin-tab",
        "brand_name": "Oxra-M 10/500",
        "molecule": "Dapagliflozin + Metformin",
        "strength": "10 mg + 500 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 620.00,
        "generic_price": 68.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["dapa m", "forxiga m", "oxra m"]
    },
    {
        "id": "sitagliptin-50mg-tab",
        "brand_name": "Januvia 50",
        "molecule": "Sitagliptin Phosphate",
        "strength": "50 mg",
        "unit": "strip of 14 tablets",
        "branded_price": 450.00,
        "generic_price": 55.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["januvia 50", "zita 50", "sitaglip 50", "जानुविया"]
    },
    {
        "id": "sitagliptin-100mg-tab",
        "brand_name": "Januvia 100",
        "molecule": "Sitagliptin Phosphate",
        "strength": "100 mg",
        "unit": "strip of 14 tablets",
        "branded_price": 720.00,
        "generic_price": 82.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["januvia 100", "zita 100", "sitaglip 100"]
    },
    {
        "id": "sitagliptin-metformin-tab",
        "brand_name": "Janumet 50/500",
        "molecule": "Sitagliptin + Metformin",
        "strength": "50 mg + 500 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 620.00,
        "generic_price": 75.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["janumet", "zita met", "जानुमेट"]
    },
    {
        "id": "teneligliptin-metformin-tab",
        "brand_name": "Ziten-M 20/500",
        "molecule": "Teneligliptin + Metformin",
        "strength": "20 mg + 500 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 195.00,
        "generic_price": 32.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["ziten m", "dynaglipt m", "tenalim m"]
    },
    {
        "id": "voglibose-0-3mg-tab",
        "brand_name": "Volibo 0.3",
        "molecule": "Voglibose",
        "strength": "0.3 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 110.00,
        "generic_price": 16.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["volibo 0.3", "vogli 0.3", "advog 0.3"]
    },
    {
        "id": "glipizide-5mg-tab",
        "brand_name": "Glynase 5",
        "molecule": "Glipizide",
        "strength": "5 mg",
        "unit": "strip of 20 tablets",
        "branded_price": 42.00,
        "generic_price": 6.50,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["glynase 5", "glipid 5", "minidiab 5"]
    },
    {
        "id": "pioglitazone-15mg-tab",
        "brand_name": "Pioz 15",
        "molecule": "Pioglitazone Hydrochloride",
        "strength": "15 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 68.00,
        "generic_price": 9.50,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["pioz 15", "pioglit 15", "actos 15"]
    },
    {
        "id": "pioglitazone-30mg-tab",
        "brand_name": "Pioz 30",
        "molecule": "Pioglitazone Hydrochloride",
        "strength": "30 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 115.00,
        "generic_price": 16.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["pioz 30", "pioglit 30", "actos 30"]
    },

    # --- Cholesterol, Statins & Fibrates ---
    {
        "id": "rosuvastatin-5mg-tab",
        "brand_name": "Rozavel 5",
        "molecule": "Rosuvastatin",
        "strength": "5 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 98.00,
        "generic_price": 12.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["rozavel 5", "rosuvas 5", "crestor 5"]
    },
    {
        "id": "rosuvastatin-aspirin-tab",
        "brand_name": "Rozavel-A 10",
        "molecule": "Rosuvastatin + Aspirin",
        "strength": "10 mg + 75 mg",
        "unit": "strip of 10 capsules",
        "branded_price": 185.00,
        "generic_price": 26.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["rozavel a", "rosuvas a", "crestor a"]
    },
    {
        "id": "atorvastatin-fenofibrate-tab",
        "brand_name": "Atorva-TG 10",
        "molecule": "Atorvastatin + Fenofibrate",
        "strength": "10 mg + 145 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 195.00,
        "generic_price": 28.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["atorva tg", "storvas tg", "atorlip f"]
    },
    {
        "id": "ezetimibe-10mg-tab",
        "brand_name": "Ezentia 10",
        "molecule": "Ezetimibe",
        "strength": "10 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 165.00,
        "generic_price": 24.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["ezentia 10", "zetia 10", "ezetimac 10"]
    },

    # --- Respiratory, Cough & Allergy ---
    {
        "id": "bilastine-20mg-tab",
        "brand_name": "Bilaxten 20",
        "molecule": "Bilastine",
        "strength": "20 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 180.00,
        "generic_price": 28.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["bilaxten 20", "bilashine 20", "bilavel 20"]
    },
    {
        "id": "deflazacort-6mg-tab",
        "brand_name": "Defcort 6",
        "molecule": "Deflazacort",
        "strength": "6 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 125.00,
        "generic_price": 19.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["defcort 6", "cortimax 6", "deflaza 6", "डेफकोर्ट"]
    },
    {
        "id": "deflazacort-12mg-tab",
        "brand_name": "Defcort 12",
        "molecule": "Deflazacort",
        "strength": "12 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 220.00,
        "generic_price": 32.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["defcort 12", "cortimax 12"]
    },
    {
        "id": "dextromethorphan-chlorpheniramine-syp",
        "brand_name": "Ascoril-D Plus",
        "molecule": "Dextromethorphan + Chlorpheniramine",
        "strength": "10 mg + 2 mg / 5 ml",
        "unit": "bottle of 100 ml",
        "branded_price": 120.00,
        "generic_price": 24.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["ascoril d", "benadryl dr", "koflet", "एस्कोरिल डी"]
    },
    {
        "id": "ambroxol-levosalbutamol-guaifenesin-syp",
        "brand_name": "Ascoril-LS Syrup",
        "molecule": "Ambroxol + Levosalbutamol + Guaifenesin",
        "strength": "30 mg + 1 mg + 50 mg / 5 ml",
        "unit": "bottle of 100 ml",
        "branded_price": 135.00,
        "generic_price": 28.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["ascoril ls", "bro-zedex ls", "mucolite ls", "एस्कोरिल एलएस"]
    },
    {
        "id": "deriphyllin-retard-150-tab",
        "brand_name": "Deriphyllin Retard 150",
        "molecule": "Theophylline + Etofylline",
        "strength": "115 mg + 35 mg",
        "unit": "strip of 30 tablets",
        "branded_price": 38.00,
        "generic_price": 6.50,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["deriphyllin 150", "etophylline theophylline", "डेरीफाइलिन"]
    },
    {
        "id": "deriphyllin-retard-300-tab",
        "brand_name": "Deriphyllin Retard 300",
        "molecule": "Theophylline + Etofylline",
        "strength": "231 mg + 69 mg",
        "unit": "strip of 30 tablets",
        "branded_price": 58.00,
        "generic_price": 9.50,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["deriphyllin 300"]
    },
    {
        "id": "seroflo-250-inhaler",
        "brand_name": "Seroflo 250 Inhaler",
        "molecule": "Salmeterol + Fluticasone Propionate",
        "strength": "25 mcg + 250 mcg",
        "unit": "inhaler of 120 doses",
        "branded_price": 650.00,
        "generic_price": 145.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["seroflo 250", "seretide 250", "combitide 250"]
    },
    {
        "id": "asthalin-inhaler-100mcg",
        "brand_name": "Asthalin Inhaler",
        "molecule": "Salbutamol",
        "strength": "100 mcg",
        "unit": "inhaler of 200 doses",
        "branded_price": 165.00,
        "generic_price": 45.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["asthalin inhaler", "ventolin inhaler", "salbutamol inhaler"]
    },
    {
        "id": "budesonide-0-5-respules",
        "brand_name": "Budecort 0.5 Respules",
        "molecule": "Budesonide",
        "strength": "0.5 mg / 2 ml",
        "unit": "pack of 5 respules",
        "branded_price": 145.00,
        "generic_price": 32.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["budecort 0.5", "pulmicort", "budez respules"]
    },

    # --- Thyroid & Hormones ---
    {
        "id": "carbimazole-5mg-tab",
        "brand_name": "Neo-Mercazole 5",
        "molecule": "Carbimazole",
        "strength": "5 mg",
        "unit": "bottle of 100 tablets",
        "branded_price": 120.00,
        "generic_price": 18.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["neo mercazole 5", "thyrocab 5"]
    },
    {
        "id": "medroxyprogesterone-10mg-tab",
        "brand_name": "Deviry 10",
        "molecule": "Medroxyprogesterone Acetate",
        "strength": "10 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 85.00,
        "generic_price": 14.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["deviry 10", "provera 10", "meprate 10"]
    },
    {
        "id": "norethisterone-5mg-tab",
        "brand_name": "Primolut-N",
        "molecule": "Norethisterone",
        "strength": "5 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 78.00,
        "generic_price": 12.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["primolut n", "regestrone 5", "crina nrc"]
    },

    # --- Vitamins & Supplements ---
    {
        "id": "vitamin-b-complex-c-cap",
        "brand_name": "Becosules Capsules",
        "molecule": "Vitamin B-Complex + Vitamin C",
        "strength": "B-Complex + 150 mg Vitamin C",
        "unit": "strip of 20 capsules",
        "branded_price": 52.00,
        "generic_price": 11.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["becosules", "b complex", "becozinc", "बीकोस्यूल्स"]
    },
    {
        "id": "multivitamin-multimineral-tab",
        "brand_name": "Zincovit Tablets",
        "molecule": "Multivitamins + Multiminerals + Zinc",
        "strength": "Multivitamin + 22.5 mg Zinc",
        "unit": "strip of 15 tablets",
        "branded_price": 115.00,
        "generic_price": 22.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["zincovit", "supradyn", "a to z", "जिंकोविट"]
    },
    {
        "id": "vitamin-e-400mg-cap",
        "brand_name": "Evion 400",
        "molecule": "Tocopheryl Acetate (Vitamin E)",
        "strength": "400 mg",
        "unit": "strip of 10 capsules",
        "branded_price": 42.00,
        "generic_price": 9.50,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["evion 400", "vitamin e 400", "e-cod 400", "इवियन 400"]
    },

    # --- CNS, Neuro & Psychiatric ---
    {
        "id": "amitriptyline-10mg-tab",
        "brand_name": "Tryptomer 10",
        "molecule": "Amitriptyline Hydrochloride",
        "strength": "10 mg",
        "unit": "strip of 30 tablets",
        "branded_price": 35.00,
        "generic_price": 5.50,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["tryptomer 10", "amitryn 10", "eliwel 10"]
    },
    {
        "id": "amitriptyline-25mg-tab",
        "brand_name": "Tryptomer 25",
        "molecule": "Amitriptyline Hydrochloride",
        "strength": "25 mg",
        "unit": "strip of 30 tablets",
        "branded_price": 58.00,
        "generic_price": 8.50,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["tryptomer 25", "amitryn 25", "eliwel 25"]
    },
    {
        "id": "paroxetine-12-5mg-cr-tab",
        "brand_name": "Pexep 12.5 CR",
        "molecule": "Paroxetine (Controlled Release)",
        "strength": "12.5 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 165.00,
        "generic_price": 26.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["pexep 12.5", "paxidep 12.5", "panex cr 12.5"]
    },
    {
        "id": "duloxetine-20mg-cap",
        "brand_name": "Duzela 20",
        "molecule": "Duloxetine Hydrochloride",
        "strength": "20 mg",
        "unit": "strip of 10 capsules",
        "branded_price": 145.00,
        "generic_price": 22.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["duzela 20", "dulane 20", "symbal 20"]
    },
    {
        "id": "sodium-valproate-200mg-tab",
        "brand_name": "Encorate 200",
        "molecule": "Sodium Valproate",
        "strength": "200 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 62.00,
        "generic_price": 9.50,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["encorate 200", "valparin 200", "depakote 200"]
    },
    {
        "id": "sodium-valproate-500mg-cr-tab",
        "brand_name": "Encorate Chrono 500",
        "molecule": "Sodium Valproate + Valproic Acid",
        "strength": "500 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 185.00,
        "generic_price": 28.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["encorate chrono 500", "epival 500", "valparin chrono 500"]
    },
    {
        "id": "levetiracetam-500mg-tab",
        "brand_name": "Levipil 500",
        "molecule": "Levetiracetam",
        "strength": "500 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 165.00,
        "generic_price": 28.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["levipil 500", "keppra 500", "levepsy 500"]
    },
    {
        "id": "phenytoin-100mg-tab",
        "brand_name": "Eptoin 100",
        "molecule": "Phenytoin Sodium",
        "strength": "100 mg",
        "unit": "bottle of 120 tablets",
        "branded_price": 180.00,
        "generic_price": 26.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["eptoin 100", "dilantin 100", "एप्सोइन"]
    },
    {
        "id": "baclofen-10mg-tab",
        "brand_name": "Lioresal 10",
        "molecule": "Baclofen",
        "strength": "10 mg",
        "unit": "strip of 10 tablets",
        "branded_price": 125.00,
        "generic_price": 18.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["lioresal 10", "baclof 10", "spinax 10"]
    },

    # --- Dermatology & Antifungals ---
    {
        "id": "luliconazole-1-cream",
        "brand_name": "Lulifin 1% Cream",
        "molecule": "Luliconazole",
        "strength": "1 % w/w",
        "unit": "tube of 30 gm",
        "branded_price": 245.00,
        "generic_price": 45.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["lulifin", "lulican", "luly 1%"]
    },
    {
        "id": "clobetasol-0-05-cream",
        "brand_name": "Tenovate Cream",
        "molecule": "Clobetasol Propionate",
        "strength": "0.05 % w/w",
        "unit": "tube of 30 gm",
        "branded_price": 85.00,
        "generic_price": 14.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["tenovate", "clop g", "dermovate"]
    },
    {
        "id": "fusidic-acid-2-cream",
        "brand_name": "Fucidin 2% Cream",
        "molecule": "Fusidic Acid",
        "strength": "2 % w/w",
        "unit": "tube of 15 gm",
        "branded_price": 135.00,
        "generic_price": 22.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["fucidin", "fusiderm", "fucibet"]
    },
    {
        "id": "ketoconazole-2-shampoo",
        "brand_name": "Nizral 2% Shampoo",
        "molecule": "Ketoconazole",
        "strength": "2 % w/v",
        "unit": "bottle of 100 ml",
        "branded_price": 295.00,
        "generic_price": 58.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["nizral", "scalpe plus", "danfree"]
    },
    {
        "id": "povidone-iodine-10-sol",
        "brand_name": "Betadine 10% Solution",
        "molecule": "Povidone Iodine",
        "strength": "10 % w/v",
        "unit": "bottle of 100 ml",
        "branded_price": 140.00,
        "generic_price": 28.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["betadine", "cipladine", "poviz"]
    },

    # --- Eye, Ear & Nasal ---
    {
        "id": "xylometazoline-0-1-nasal",
        "brand_name": "Otrivin Adult Drops",
        "molecule": "Xylometazoline Hydrochloride",
        "strength": "0.1 % w/v",
        "unit": "bottle of 10 ml",
        "branded_price": 72.00,
        "generic_price": 14.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["otrivin", "nasivion", "decongestant drops"]
    },
    {
        "id": "olopatadine-0-1-eyedrop",
        "brand_name": "Pataday 0.1% Eye Drops",
        "molecule": "Olopatadine Hydrochloride",
        "strength": "0.1 % w/v",
        "unit": "bottle of 5 ml",
        "branded_price": 165.00,
        "generic_price": 28.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["pataday", "olopat", "winolap"]
    },

    # --- Urology & Men's Health ---
    {
        "id": "silodosin-8mg-cap",
        "brand_name": "Silodal 8",
        "molecule": "Silodosin",
        "strength": "8 mg",
        "unit": "strip of 10 capsules",
        "branded_price": 340.00,
        "generic_price": 55.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["silodal 8", "rapaflo 8", "silofast 8"]
    },
    {
        "id": "dutasteride-0-5mg-cap",
        "brand_name": "Dutas 0.5",
        "molecule": "Dutasteride",
        "strength": "0.5 mg",
        "unit": "strip of 15 capsules",
        "branded_price": 195.00,
        "generic_price": 32.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["dutas", "avodart", "dutagen"]
    },
    {
        "id": "tadalafil-10mg-tab",
        "brand_name": "Megalis 10",
        "molecule": "Tadalafil",
        "strength": "10 mg",
        "unit": "strip of 4 tablets",
        "branded_price": 180.00,
        "generic_price": 26.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["megalis 10", "cialis 10", "forzest 10"]
    },
    {
        "id": "sildenafil-50mg-tab",
        "brand_name": "Manforce 50",
        "molecule": "Sildenafil Citrate",
        "strength": "50 mg",
        "unit": "strip of 4 tablets",
        "branded_price": 140.00,
        "generic_price": 22.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["manforce 50", "viagra 50", "penegra 50"]
    },

    # --- Corticosteroids ---
    {
        "id": "prednisolone-5mg-tab",
        "brand_name": "Wysolone 5",
        "molecule": "Prednisolone",
        "strength": "5 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 14.00,
        "generic_price": 2.50,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["wysolone 5", "omnacortil 5", "प्रेडनिसोलोन"]
    },
    {
        "id": "prednisolone-10mg-tab",
        "brand_name": "Wysolone 10",
        "molecule": "Prednisolone",
        "strength": "10 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 24.00,
        "generic_price": 4.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["wysolone 10", "omnacortil 10", "predone 10"]
    },
    {
        "id": "prednisolone-20mg-tab",
        "brand_name": "Wysolone 20",
        "molecule": "Prednisolone",
        "strength": "20 mg",
        "unit": "strip of 15 tablets",
        "branded_price": 42.00,
        "generic_price": 6.50,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["wysolone 20", "omnacortil 20", "predone 20"]
    },
    {
        "id": "dexamethasone-0-5mg-tab",
        "brand_name": "Dexona 0.5",
        "molecule": "Dexamethasone",
        "strength": "0.5 mg",
        "unit": "strip of 30 tablets",
        "branded_price": 8.50,
        "generic_price": 1.80,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["dexona", "decadron 0.5", "डेक्सोना"]
    },
    {
        "id": "methylprednisolone-4mg-tab",
        "brand_name": "Medrol 4",
        "molecule": "Methylprednisolone",
        "strength": "4 mg",
        "unit": "strip of 14 tablets",
        "branded_price": 78.00,
        "generic_price": 14.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["medrol 4", "zempred 4", "macpred 4"]
    },
    {
        "id": "methylprednisolone-8mg-tab",
        "brand_name": "Medrol 8",
        "molecule": "Methylprednisolone",
        "strength": "8 mg",
        "unit": "strip of 14 tablets",
        "branded_price": 135.00,
        "generic_price": 22.00,
        "source": "PMBJP Price List 2024 / NPPA",
        "aliases": ["medrol 8", "zempred 8", "macpred 8"]
    }
]


def main():
    combined = []
    seen_ids = set()

    for item in EXISTING_106 + ADDITIONAL_DRUGS:
        item_id = item["id"]
        if item_id not in seen_ids:
            seen_ids.add(item_id)
            combined.append(item)

    print(f"Total compiled unique records: {len(combined)}")

    target_path = Path(__file__).resolve().parent.parent / "data" / "curated_drugs.json"
    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(combined, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Run full normalization and verification
    norm_records, dataset_hash, errors = process_dataset(target_path)
    if errors:
        print("Validation errors:")
        for e in errors:
            print(" -", e)
        exit(1)

    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(norm_records, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"SUCCESS: Normalized and saved {len(norm_records)} drugs to {target_path}")
    print(f"New canonical SHA256 dataset hash: {dataset_hash}")


if __name__ == "__main__":
    main()

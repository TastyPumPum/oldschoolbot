import { QuestID } from '@/lib/minions/data/quests.js';

export type SeaChartingTaskType = 'Generic' | 'Spyglass' | 'Crate' | 'Current' | 'Diving' | 'Weather';

export interface SeaChartingTask {
	id: number;
	level: number;
	type: SeaChartingTaskType;
	sea: string;
	ocean: string;
}

export interface SeaChartingCompletionBonus {
	ocean: string;
	sea: string;
	taskCount: number;
	xp: number;
}

export const seaChartingTaskXP: Record<SeaChartingTaskType, number> = {
	Generic: 35,
	Spyglass: 50,
	Crate: 75,
	Current: 125,
	Diving: 175,
	Weather: 250
};

export const seaChartingTaskRequiredQuest: Partial<Record<SeaChartingTaskType, QuestID>> = {
	Crate: QuestID.PryingTimes,
	Current: QuestID.CurrentAffairs
};

const rawSeaChartingTasks = [
	'0,1,Generic,Bay of Sarim,Ardent Ocean;1,1,Generic,Bay of Sarim,Ardent Ocean;2,1,Spyglass,Bay of Sarim,Bonus charts;4,1,Generic,Bay of Sarim,Ardent Ocean;5,1,Generic,Bay of Sarim,Ar',
	'dent Ocean;6,1,Generic,Mudskipper Sound,Ardent Ocean;7,1,Generic,Kharidian Sea,Ardent Ocean;8,1,Generic,Mudskipper Sound,Ardent Ocean;10,1,Spyglass,Mudskipper Sound,Ardent Ocean;14',
	',1,Spyglass,Kharidian Sea,Ardent Ocean;15,1,Generic,Kharidian Sea,Ardent Ocean;16,1,Generic,Kharidian Sea,Ardent Ocean;17,1,Generic,Lumbridge Basin,Ardent Ocean;18,1,Generic,Lumbri',
	'dge Basin,Ardent Ocean;19,1,Spyglass,Lumbridge Basin,Ardent Ocean;21,1,Generic,Rimmington Strait,Ardent Ocean;22,1,Generic,Rimmington Strait,Ardent Ocean;23,1,Spyglass,Rimmington S',
	'trait,Ardent Ocean;25,1,Generic,Catherby Bay,Ardent Ocean;26,1,Generic,Catherby Bay,Ardent Ocean;27,1,Spyglass,Catherby Bay,Ardent Ocean;29,1,Generic,Brimhaven Passage,Ardent Ocean',
	';30,1,Generic,Brimhaven Passage,Ardent Ocean;31,1,Spyglass,Brimhaven Passage,Ardent Ocean;33,1,Generic,Strait of Khazard,Ardent Ocean;34,1,Generic,Strait of Khazard,Ardent Ocean;35',
	',1,Generic,Strait of Khazard,Ardent Ocean;36,1,Spyglass,Strait of Khazard,Ardent Ocean;76,1,Spyglass,The Simian Sea,Ardent Ocean;77,1,Spyglass,Arrow Passage,Ardent Ocean;82,1,Spygl',
	"ass,Bay of Elidinis,Unquiet Ocean;83,1,Spyglass,Anglerfish's Light,Unquiet Ocean;84,1,Generic,The Simian Sea,Ardent Ocean;85,1,Generic,Oo'glog Channel,Ardent Ocean;86,1,Generic,Red",
	' Reef,Unquiet Ocean;87,1,Generic,The Skullhorde,Shrouded Ocean;88,1,Generic,Barracuda Belt,Shrouded Ocean;89,1,Generic,Barracuda Belt,Shrouded Ocean;90,1,Generic,Kharazi Strait,Ard',
	'ent Ocean;91,1,Generic,Arrow Passage,Ardent Ocean;92,1,Generic,Kharazi Strait,Ardent Ocean;93,1,Generic,Kharazi Strait,Ardent Ocean;94,1,Generic,Turtle Belt,Unquiet Ocean;95,1,Gene',
	"ric,Barracuda Belt,Shrouded Ocean;98,1,Generic,Tortugan Sea,Unquiet Ocean;102,1,Generic,The Lonely Sea,Unquiet Ocean;103,1,Generic,Anglerfish's Light,Unquiet Ocean;108,1,Spyglass,G",
	"u'tanoth Bay,Ardent Ocean;109,1,Spyglass,Oo'glog Channel,Ardent Ocean;113,1,Spyglass,Zul-Egil,Shrouded Ocean;135,1,Generic,Gu'tanoth Bay,Ardent Ocean;136,1,Generic,Feldip Gulf,Arde",
	"nt Ocean;137,1,Generic,Oo'glog Channel,Ardent Ocean;139,1,Generic,Sea of Souls,Shrouded Ocean;142,1,Generic,Western Gate,Shrouded Ocean;143,1,Generic,Soul Bay,Shrouded Ocean;157,1,",
	'Generic,Western Gate,Shrouded Ocean;158,1,Generic,Crystal Sea,Western Ocean;161,1,Generic,Vagabonds Rest,Western Ocean;177,1,Spyglass,Piscatoris Sea,Western Ocean;178,1,Spyglass,Ho',
	'sidian Sea,Western Ocean;179,1,Spyglass,Gulf of Kourend,Western Ocean;186,1,Generic,Vagabonds Rest,Western Ocean;187,1,Generic,Piscatoris Sea,Western Ocean;188,1,Generic,Hosidian S',
	'ea,Western Ocean;189,1,Generic,Gulf of Kourend,Western Ocean;191,1,Spyglass,Menaphite Sea,Ardent Ocean;193,1,Generic,Menaphite Sea,Ardent Ocean;196,1,Generic,Fremensund,Northern Oc',
	"ean;197,1,Generic,Grandroot Bay,Northern Ocean;198,1,Generic,V's Belt,Northern Ocean;199,1,Generic,Fremennik Strait,Northern Ocean;201,1,Generic,Lunar Bay,Northern Ocean;228,1,Spyg",
	"lass,Fremensund,Northern Ocean;229,1,Spyglass,Grandroot Bay,Northern Ocean;230,1,Spyglass,V's Belt,Northern Ocean;231,1,Spyglass,Fremennik Strait,Northern Ocean;232,1,Spyglass,Ides",
	"tia Strait,Northern Ocean;233,1,Spyglass,Lunar Bay,Northern Ocean;234,1,Spyglass,Winter's Edge,Northern Ocean;270,1,Spyglass,Tortugan Sea,Unquiet Ocean;276,1,Generic,Bay of Elidini",
	"s,Unquiet Ocean;277,1,Generic,Pearl Bank,Unquiet Ocean;285,1,Spyglass,Fortis Bay,Shrouded Ocean;286,1,Spyglass,Aureum Coast,Shrouded Ocean;287,1,Spyglass,Wyrm's Waters,Shrouded Oce",
	'an;288,1,Spyglass,The Everdeep,Shrouded Ocean;289,1,Spyglass,Sapphire Sea,Shrouded Ocean;297,1,Generic,Fortis Bay,Shrouded Ocean;298,1,Generic,Aureum Coast,Shrouded Ocean;299,1,Gen',
	"eric,Wyrm's Waters,Shrouded Ocean;300,1,Generic,The Everdeep,Shrouded Ocean;301,1,Generic,Sapphire Sea,Shrouded Ocean;316,1,Spyglass,Great Sound,Western Ocean;317,1,Spyglass,Crabcl",
	'aw Bay,Western Ocean;318,1,Spyglass,Crabclaw Bay,Western Ocean;319,1,Spyglass,Crystal Sea,Western Ocean;320,1,Spyglass,Vagabonds Rest,Western Ocean;336,1,Generic,Great Sound,Wester',
	"n Ocean;337,1,Generic,Great Sound,Western Ocean;338,1,Generic,Crabclaw Bay,Western Ocean;339,1,Generic,Pilgrims' Passage,Western Ocean;340,1,Generic,Litus Lucis,Western Ocean;341,1",
	',Generic,Crystal Sea,Western Ocean;342,1,Generic,Moonshadow,Western Ocean;343,1,Spyglass,Sunset Bay,Sunset Ocean;344,1,Spyglass,Misty Sea,Sunset Ocean;351,1,Generic,Sunset Bay,Suns',
	"et Ocean;352,1,Generic,Misty Sea,Sunset Ocean;353,1,Generic,Dusk's Maw,Sunset Ocean;357,1,Spyglass,Kharidian Sea,Ardent Ocean;11,12,Crate,Kharidian Sea,Bonus charts;38,12,Crate,Mud",
	'skipper Sound,Bonus charts;39,12,Crate,Lumbridge Basin,Bonus charts;40,12,Crate,Catherby Bay,Ardent Ocean;41,12,Crate,Strait of Khazard,Ardent Ocean;60,12,Crate,The Simian Sea,Arde',
	'nt Ocean;61,12,Crate,Barracuda Belt,Shrouded Ocean;62,12,Crate,Arrow Passage,Ardent Ocean;63,12,Crate,Kharazi Strait,Ardent Ocean;64,12,Crate,Turtle Belt,Unquiet Ocean;65,12,Crate,',
	"Sea of Shells,Unquiet Ocean;67,12,Crate,Anglerfish's Light,Unquiet Ocean;115,12,Crate,Gu'tanoth Bay,Ardent Ocean;116,12,Crate,Feldip Gulf,Ardent Ocean;117,12,Crate,Oo'glog Channel,",
	'Ardent Ocean;118,12,Crate,Mythic Sea,Shrouded Ocean;122,12,Crate,Soul Bay,Shrouded Ocean;123,12,Crate,Sea of Souls,Shrouded Ocean;162,12,Crate,Western Gate,Shrouded Ocean;163,12,Cr',
	'ate,Crystal Sea,Western Ocean;181,12,Crate,Vagabonds Rest,Western Ocean;182,12,Crate,Hosidian Sea,Western Ocean;183,12,Crate,Gulf of Kourend,Western Ocean;195,12,Crate,Menaphite Se',
	"a,Ardent Ocean;253,12,Crate,Fremensund,Northern Ocean;254,12,Crate,Grandroot Bay,Northern Ocean;255,12,Crate,V's Belt,Northern Ocean;256,12,Crate,Fremennik Strait,Northern Ocean;25",
	'7,12,Crate,Idestia Strait,Northern Ocean;258,12,Crate,Lunar Bay,Northern Ocean;261,12,Crate,Kannski Tides,Northern Ocean;278,12,Crate,Red Reef,Unquiet Ocean;279,12,Crate,Bay of Eli',
	'dinis,Unquiet Ocean;280,12,Crate,Pearl Bank,Unquiet Ocean;281,12,Crate,The Lonely Sea,Unquiet Ocean;290,12,Crate,Fortis Bay,Shrouded Ocean;291,12,Crate,Aureum Coast,Shrouded Ocean;',
	"292,12,Crate,Wyrm's Waters,Shrouded Ocean;293,12,Crate,The Skullhorde,Shrouded Ocean;294,12,Crate,The Everdeep,Shrouded Ocean;295,12,Crate,Sapphire Sea,Shrouded Ocean;331,12,Crate,",
	"Great Sound,Bonus charts;332,12,Crate,Pilgrims' Passage,Western Ocean;333,12,Crate,Litus Lucis,Western Ocean;334,12,Crate,Piscatoris Sea,Western Ocean;335,12,Crate,Moonshadow,Weste",
	"rn Ocean;354,12,Crate,Sunset Bay,Sunset Ocean;355,12,Crate,Misty Sea,Sunset Ocean;356,12,Crate,Dusk's Maw,Sunset Ocean;3,22,Current,Bay of Sarim,Bonus charts;9,22,Current,Mudskippe",
	'r Sound,Bonus charts;13,22,Current,Kharidian Sea,Bonus charts;20,22,Current,Lumbridge Basin,Bonus charts;24,22,Current,Rimmington Strait,Ardent Ocean;28,22,Current,Catherby Bay,Bon',
	'us charts;32,22,Current,Brimhaven Passage,Ardent Ocean;37,22,Current,Strait of Khazard,Ardent Ocean;68,22,Current,The Simian Sea,Ardent Ocean;69,22,Current,The Simian Sea,Ardent Oc',
	'ean;70,22,Current,Kharazi Strait,Ardent Ocean;71,22,Current,Red Reef,Unquiet Ocean;73,22,Current,Sea of Shells,Unquiet Ocean;75,22,Current,The Lonely Sea,Unquiet Ocean;130,22,Curre',
	"nt,Feldip Gulf,Ardent Ocean;133,22,Current,Soul Bay,Shrouded Ocean;147,22,Current,Western Gate,Shrouded Ocean;174,22,Current,Pilgrims' Passage,Western Ocean;175,22,Current,Gulf of ",
	"Kourend,Western Ocean;194,22,Current,Menaphite Sea,Ardent Ocean;209,22,Current,Fremensund,Northern Ocean;210,22,Current,Grandroot Bay,Northern Ocean;211,22,Current,V's Belt,Norther",
	'n Ocean;212,22,Current,Fremennik Strait,Northern Ocean;213,22,Current,Idestia Strait,Northern Ocean;214,22,Current,Lunar Bay,Northern Ocean;266,22,Current,Turtle Belt,Unquiet Ocean',
	';267,22,Current,Bay of Elidinis,Unquiet Ocean;268,22,Current,Tortugan Sea,Unquiet Ocean;269,22,Current,Pearl Bank,Unquiet Ocean;303,22,Current,Fortis Bay,Shrouded Ocean;304,22,Curr',
	"ent,Wyrm's Waters,Shrouded Ocean;305,22,Current,The Skullhorde,Shrouded Ocean;306,22,Current,Sapphire Sea,Shrouded Ocean;327,22,Current,Great Sound,Bonus charts;328,22,Current,Litu",
	"s Lucis,Western Ocean;329,22,Current,Crystal Sea,Western Ocean;330,22,Current,Moonshadow,Western Ocean;346,22,Current,Sunset Bay,Sunset Ocean;347,22,Current,Dusk's Maw,Sunset Ocean",
	';72,24,Current,The Storm Tempor,Ardent Ocean;78,24,Spyglass,Kharazi Strait,Ardent Ocean;80,24,Spyglass,The Storm Tempor,Ardent Ocean;96,24,Generic,The Storm Tempor,Ardent Ocean;97,',
	'24,Generic,The Storm Tempor,Ardent Ocean;12,38,Diving,Kharidian Sea,Bonus charts;44,38,Diving,Mudskipper Sound,Bonus charts;45,38,Diving,Catherby Bay,Bonus charts;46,38,Diving,Stra',
	'it of Khazard,Bonus charts;47,38,Diving,Red Reef,Unquiet Ocean;48,38,Diving,Barracuda Belt,Shrouded Ocean;49,38,Diving,Arrow Passage,Ardent Ocean;50,38,Diving,Turtle Belt,Unquiet O',
	"cean;51,38,Diving,Tortugan Sea,Unquiet Ocean;53,38,Diving,Anglerfish's Light,Unquiet Ocean;125,38,Diving,Gu'tanoth Bay,Ardent Ocean;126,38,Diving,Oo'glog Channel,Ardent Ocean;129,3",
	'8,Diving,Soul Bay,Shrouded Ocean;152,38,Diving,Western Gate,Shrouded Ocean;153,38,Diving,Crystal Sea,Western Ocean;155,38,Diving,Sapphire Sea,Shrouded Ocean;172,38,Diving,Gulf of K',
	'ourend,Bonus charts;192,38,Diving,Menaphite Sea,Ardent Ocean;241,38,Diving,Fremensund,Northern Ocean;242,38,Diving,Grandroot Bay,Northern Ocean;245,38,Diving,Lunar Bay,Northern Oce',
	'an;271,38,Diving,Sea of Shells,Unquiet Ocean;272,38,Diving,Bay of Elidinis,Unquiet Ocean;273,38,Diving,Pearl Bank,Unquiet Ocean;274,38,Diving,The Lonely Sea,Unquiet Ocean;307,38,Di',
	"ving,Fortis Bay,Shrouded Ocean;308,38,Diving,Aureum Coast,Shrouded Ocean;309,38,Diving,Wyrm's Waters,Shrouded Ocean;310,38,Diving,The Skullhorde,Shrouded Ocean;311,38,Diving,Sea of",
	" Souls,Shrouded Ocean;312,38,Diving,The Everdeep,Shrouded Ocean;321,38,Diving,Crabclaw Bay,Bonus charts;322,38,Diving,Hosidian Sea,Bonus charts;323,38,Diving,Pilgrims' Passage,Bonu",
	's charts;324,38,Diving,Litus Lucis,Western Ocean;325,38,Diving,Vagabonds Rest,Western Ocean;326,38,Diving,Moonshadow,Western Ocean;348,38,Diving,Sunset Bay,Sunset Ocean;349,38,Divi',
	"ng,Misty Sea,Sunset Ocean;350,38,Diving,Dusk's Maw,Sunset Ocean;79,40,Spyglass,Turtle Belt,Unquiet Ocean;110,40,Spyglass,Breakbone Strait,Shrouded Ocean;112,40,Spyglass,Backwater,S",
	'hrouded Ocean;114,40,Spyglass,Zul-Egil,Shrouded Ocean;119,40,Crate,Breakbone Strait,Shrouded Ocean;120,40,Crate,Backwater,Shrouded Ocean;121,40,Crate,Backwater,Shrouded Ocean;124,4',
	'0,Crate,Zul-Egil,Shrouded Ocean;127,40,Diving,Mythic Sea,Shrouded Ocean;128,40,Diving,Backwater,Shrouded Ocean;131,40,Current,Mythic Sea,Shrouded Ocean;132,40,Current,Breakbone Str',
	'ait,Shrouded Ocean;134,40,Current,Backwater,Shrouded Ocean;140,40,Generic,Breakbone Strait,Shrouded Ocean;141,40,Generic,Backwater,Shrouded Ocean;144,40,Generic,Zul-Egil,Shrouded O',
	'cean;81,45,Spyglass,Sea of Shells,Unquiet Ocean;99,45,Generic,Tortugan Sea,Unquiet Ocean;275,47,Generic,Sea of Shells,Unquiet Ocean;138,51,Generic,Mythic Sea,Shrouded Ocean;42,57,W',
	'eather,Rimmington Strait,Bonus charts;43,57,Weather,Strait of Khazard,Bonus charts;54,57,Weather,The Skullhorde,Bonus charts;55,57,Weather,Barracuda Belt,Shrouded Ocean;56,57,Weath',
	"er,Arrow Passage,Bonus charts;57,57,Weather,The Storm Tempor,Bonus charts;58,57,Weather,Pearl Bank,Bonus charts;59,57,Weather,Anglerfish's Light,Bonus charts;104,57,Weather,Gu'tano",
	"th Bay,Bonus charts;105,57,Weather,Breakbone Strait,Bonus charts;106,57,Weather,Soul Bay,Shrouded Ocean;168,57,Weather,Pilgrims' Passage,Bonus charts;220,57,Weather,Fremensund,Nort",
	'hern Ocean;221,57,Weather,Grandroot Bay,Northern Ocean;222,57,Weather,Fremennik Strait,Northern Ocean;282,57,Weather,Aureum Coast,Bonus charts;283,57,Weather,The Everdeep,Shrouded ',
	"Ocean;314,57,Weather,Crabclaw Bay,Bonus charts;315,57,Weather,Litus Lucis,Bonus charts;345,57,Weather,Dusk's Maw,Bonus charts;111,61,Spyglass,Sea of Souls,Shrouded Ocean;107,66,Wea",
	'ther,Porth Neigwl,Western Ocean;145,66,Weather,Tirannwn Bight,Western Ocean;146,66,Weather,Porth Neigwl,Western Ocean;148,66,Current,Porth Neigwl,Western Ocean;149,66,Current,Tiran',
	'nwn Bight,Western Ocean;150,66,Spyglass,Porth Neigwl,Western Ocean;151,66,Spyglass,Tirannwn Bight,Western Ocean;154,66,Diving,Porth Neigwl,Western Ocean;156,66,Diving,Tirannwn Bigh',
	't,Western Ocean;159,66,Generic,Porth Neigwl,Western Ocean;160,66,Generic,Tirannwn Bight,Western Ocean;164,66,Crate,Porth Neigwl,Western Ocean;165,66,Crate,Porth Gwenith,Western Oce',
	'an;166,66,Crate,Tirannwn Bight,Western Ocean;167,66,Weather,Porth Gwenith,Western Ocean;170,66,Diving,Porth Gwenith,Western Ocean;171,66,Diving,Piscatoris Sea,Western Ocean;173,66,',
	'Current,Porth Gwenith,Western Ocean;185,66,Generic,Porth Gwenith,Western Ocean;52,72,Diving,Rainbow Reef,Shrouded Ocean;66,72,Crate,Rainbow Reef,Shrouded Ocean;74,72,Current,Rainbo',
	'w Reef,Shrouded Ocean;100,72,Generic,Rainbow Reef,Shrouded Ocean;101,72,Generic,Rainbow Reef,Shrouded Ocean;284,72,Weather,Southern Expanse,Shrouded Ocean;296,72,Crate,Southern Exp',
	"anse,Shrouded Ocean;302,72,Generic,Southern Expanse,Shrouded Ocean;313,72,Diving,Southern Expanse,Shrouded Ocean;169,78,Weather,Winter's Edge,Northern Ocean;176,78,Current,Winter's",
	" Edge,Northern Ocean;180,78,Spyglass,Everwinter Sea,Northern Ocean;184,78,Crate,Winter's Edge,Northern Ocean;190,78,Generic,Everwinter Sea,Northern Ocean;200,78,Generic,Idestia Str",
	"ait,Northern Ocean;202,78,Generic,Winter's Edge,Northern Ocean;203,78,Generic,Lunar Sea,Northern Ocean;204,78,Generic,Kannski Tides,Northern Ocean;205,78,Generic,Weissmere,Northern",
	' Ocean;206,78,Generic,Stoneheart Sea,Northern Ocean;207,78,Generic,Shiverwake Expanse,Northern Ocean;208,78,Generic,Weiss Melt,Northern Ocean;215,78,Current,Everwinter Sea,Northern',
	' Ocean;216,78,Current,Kannski Tides,Northern Ocean;217,78,Current,Weissmere,Northern Ocean;218,78,Current,Stoneheart Sea,Northern Ocean;219,78,Current,Weiss Melt,Northern Ocean;223',
	',78,Weather,Idestia Strait,Northern Ocean;224,78,Weather,Everwinter Sea,Northern Ocean;225,78,Weather,Stoneheart Sea,Northern Ocean;226,78,Weather,Shiverwake Expanse,Northern Ocean',
	';227,78,Weather,Weiss Melt,Northern Ocean;235,78,Spyglass,Lunar Sea,Northern Ocean;236,78,Spyglass,Kannski Tides,Northern Ocean;237,78,Spyglass,Weissmere,Northern Ocean;238,78,Spyg',
	"lass,Stoneheart Sea,Northern Ocean;239,78,Spyglass,Shiverwake Expanse,Northern Ocean;240,78,Spyglass,Weiss Melt,Northern Ocean;243,78,Diving,V's Belt,Northern Ocean;244,78,Diving,I",
	"destia Strait,Northern Ocean;246,78,Diving,Winter's Edge,Northern Ocean;247,78,Diving,Lunar Sea,Northern Ocean;248,78,Diving,Everwinter Sea,Northern Ocean;249,78,Diving,Kannski Tid",
	'es,Northern Ocean;250,78,Diving,Weissmere,Northern Ocean;251,78,Diving,Stoneheart Sea,Northern Ocean;252,78,Diving,Shiverwake Expanse,Northern Ocean;259,78,Crate,Lunar Sea,Northern',
	' Ocean;260,78,Crate,Everwinter Sea,Northern Ocean;262,78,Crate,Weissmere,Northern Ocean;263,78,Crate,Stoneheart Sea,Northern Ocean;264,78,Crate,Shiverwake Expanse,Northern Ocean;26',
	'5,78,Crate,Weiss Melt,Northern Ocean'
].join('');

const rawSeaChartingCompletionBonuses = [
	'Ardent Ocean,Kharidian Sea,5,190;Ardent Ocean,Bay of Sarim,5,190;Ardent Ocean,Lumbridge Basin,3,190;Ardent Ocean,Mudskipper Sound,3,190;Ardent Ocean,Rimmington Strait,3,190;Ardent ',
	'Ocean,Catherby Bay,4,270;Ardent Ocean,Brimhaven Passage,4,510;Ardent Ocean,Strait of Khazard,6,510;Ardent Ocean,Feldip Gulf,3,510;Ardent Ocean,The Simian Sea,4,510;Ardent Ocean,Kha',
	"razi Strait,6,590;Ardent Ocean,The Storm Tempor,4,590;Ardent Ocean,Gu'tanoth Bay,4,1710;Ardent Ocean,Oo'glog Channel,5,1710;Ardent Ocean,Arrow Passage,5,1710;Ardent Ocean,Menaphite",
	" Sea,5,1710;Unquiet Ocean,Red Reef,5,1710;Unquiet Ocean,Anglerfish's Light,4,1710;Unquiet Ocean,Bay of Elidinis,5,1710;Unquiet Ocean,Pearl Bank,4,1710;Unquiet Ocean,The Lonely Sea,",
	'4,1710;Unquiet Ocean,Tortugan Sea,5,2880;Unquiet Ocean,Turtle Belt,5,1990;Unquiet Ocean,Sea of Shells,5,2880;Shrouded Ocean,Fortis Bay,5,1710;Shrouded Ocean,Aureum Coast,4,1710;Shr',
	"ouded Ocean,Wyrm's Waters,5,1710;Shrouded Ocean,The Skullhorde,4,1710;Shrouded Ocean,Western Gate,5,1710;Shrouded Ocean,Sapphire Sea,5,1710;Shrouded Ocean,Breakbone Strait,4,1990;S",
	'hrouded Ocean,Backwater,6,1990;Shrouded Ocean,Zul-Egil,4,1990;Shrouded Ocean,Mythic Sea,4,1990;Shrouded Ocean,Soul Bay,5,6710;Shrouded Ocean,Barracuda Belt,6,6710;Shrouded Ocean,Th',
	'e Everdeep,5,6710;Shrouded Ocean,Sea of Souls,4,8750;Shrouded Ocean,Rainbow Reef,5,17230;Shrouded Ocean,Southern Expanse,4,17230;Sunset Ocean,Sunset Bay,5,1710;Sunset Ocean,Misty S',
	"ea,4,1710;Sunset Ocean,Dusk's Maw,4,1710;Western Ocean,Great Sound,3,190;Western Ocean,Crabclaw Bay,3,190;Western Ocean,Hosidian Sea,3,270;Western Ocean,Gulf of Kourend,4,510;Weste",
	"rn Ocean,Pilgrims' Passage,3,1710;Western Ocean,Litus Lucis,4,1710;Western Ocean,Crystal Sea,6,1710;Western Ocean,Vagabonds Rest,5,1710;Western Ocean,Moonshadow,4,1710;Western Ocea",
	'n,Porth Neigwl,7,12030;Western Ocean,Tirannwn Bight,6,12030;Western Ocean,Porth Gwenith,5,12030;Western Ocean,Piscatoris Sea,4,12030;Northern Ocean,Lunar Bay,5,1710;Northern Ocean,',
	"Fremensund,6,6710;Northern Ocean,Grandroot Bay,6,6710;Northern Ocean,Fremennik Strait,5,6710;Northern Ocean,V's Belt,5,23910;Northern Ocean,Idestia Strait,6,23910;Northern Ocean,Wi",
	"nter's Edge,6,23910;Northern Ocean,Lunar Sea,4,23910;Northern Ocean,Everwinter Sea,6,23910;Northern Ocean,Kannski Tides,5,23910;Northern Ocean,Weissmere,5,23910;Northern Ocean,Ston",
	'eheart Sea,6,23910;Northern Ocean,Shiverwake Expanse,5,23910;Northern Ocean,Weiss Melt,5,23910;Bonus charts,Bonus Drinks,4,270;Bonus charts,Bonus Currents,7,510;Bonus charts,Bonus Dives,8,1710;Bonus ',
	'charts,Bonus Weather,14,6710'
].join('');

export const seaChartingTasks: SeaChartingTask[] = rawSeaChartingTasks.split(';').map(row => {
	const [id, level, type, sea, ocean] = row.split(',');
	return {
		id: Number(id),
		level: Number(level),
		type: type as SeaChartingTaskType,
		sea,
		ocean
	};
});

export const seaChartingCompletionBonuses: SeaChartingCompletionBonus[] = rawSeaChartingCompletionBonuses
	.split(';')
	.map(row => {
		const [ocean, sea, taskCount, xp] = row.split(',');
		return {
			ocean,
			sea,
			taskCount: Number(taskCount),
			xp: Number(xp)
		};
	});

export const seaChartingTaskById = new Map(seaChartingTasks.map(task => [task.id, task]));

export function userCanDoSeaChartingTask(user: MUser, task: SeaChartingTask) {
	if (user.skillsAsLevels.sailing < task.level) return false;
	const requiredQuest = seaChartingTaskRequiredQuest[task.type];
	if (requiredQuest && !user.user.finished_quest_ids.includes(requiredQuest)) return false;
	if (task.type === 'Diving') {
		return user.owns('Medallion of the deep') || (user.owns('Fishbowl helmet') && user.owns('Diving apparatus'));
	}
	return true;
}

export function getEligibleSeaChartingTasks(user: MUser, completedTaskIds: number[]) {
	const completed = new Set(completedTaskIds);
	return seaChartingTasks.filter(task => !completed.has(task.id) && userCanDoSeaChartingTask(user, task));
}

export function getSeaChartingCompletionKey(bonus: SeaChartingCompletionBonus) {
	return `${bonus.ocean}:${bonus.sea}`;
}

function taskMatchesCompletionBonus(task: SeaChartingTask, bonus: SeaChartingCompletionBonus) {
	if (bonus.ocean !== 'Bonus charts') return task.sea === bonus.sea;
	if (task.ocean !== 'Bonus charts') return false;
	if (bonus.sea === 'Bonus Drinks') return task.type === 'Crate';
	if (bonus.sea === 'Bonus Dives') return task.type === 'Diving';
	if (bonus.sea === 'Bonus Weather') return task.type === 'Weather';
	if (bonus.sea === 'Bonus Currents') {
		return task.type !== 'Crate' && task.type !== 'Diving' && task.type !== 'Weather';
	}
	return false;
}

export function getSeaChartingCompletionBonusesForTask(task: SeaChartingTask) {
	return seaChartingCompletionBonuses.filter(bonus => taskMatchesCompletionBonus(task, bonus));
}

export function getSeaChartingCompletionGroupTasks(bonus: SeaChartingCompletionBonus) {
	return seaChartingTasks.filter(task => taskMatchesCompletionBonus(task, bonus));
}

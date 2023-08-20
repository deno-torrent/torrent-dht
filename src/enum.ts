// Azureus风格使用以下编码：'-'，两个字符表示客户端ID，四个ASCII数字表示版本号，'-'，后跟随机数字。
// 例如：'-AZ2060-' 2060是Azureus的版本号
export enum AZStyleClient {
  '7T' = 'aTorrent for Android',
  'AB' = 'AnyEvent::BitTorrent',
  'AG' = 'Ares',
  'A~' = 'Ares',
  'AR' = 'Arctic',
  'AV' = 'Avicora',
  'AT' = 'Artemis',
  'AX' = 'BitPump',
  'AZ' = 'Azureus',
  'BB' = 'BitBuddy',
  'BC' = 'BitComet',
  'BE' = 'Baretorrent',
  'BF' = 'Bitflu',
  'BG' = 'BTG (uses Rasterbar libtorrent)',
  'BL' = 'BitCometLite (uses 6 digit version number)',
  'BP' = 'BitTorrent Pro (Azureus + spyware)',
  'BR' = 'BitRocket',
  'BS' = 'BTSlave',
  'BT' = 'mainline BitTorrent (versions >= 7.9)',
  'Bt' = 'Bt',
  'BW' = 'BitWombat',
  'BX' = '~Bittorrent X',
  'CD' = 'Enhanced CTorrent',
  'CT' = 'CTorrent',
  'DE' = 'DelugeTorrent',
  'DP' = 'Propagate Data Client',
  'EB' = 'EBit',
  'ES' = 'electric sheep',
  'FC' = 'FileCroc',
  'FD' = 'Free Download Manager (versions >= 5.1.12)',
  'FT' = 'FoxTorrent',
  'FX' = 'Freebox BitTorrent',
  'GS' = 'GSTorrent',
  'HK' = 'Hekate',
  'HL' = 'Halite',
  'HM' = 'hMule (uses Rasterbar libtorrent)',
  'HN' = 'Hydranode',
  'IL' = 'iLivid',
  'JS' = 'Justseed.it client',
  'JT' = 'JavaTorrent',
  'KG' = 'KGet',
  'KT' = 'KTorrent',
  'LC' = 'LeechCraft',
  'LH' = 'LH-ABC',
  'LP' = 'Lphant',
  'LT' = 'libtorrent',
  'lt' = 'libTorrent',
  'LW' = 'LimeWire',
  'MK' = 'Meerkat',
  'MO' = 'MonoTorrent',
  'MP' = 'MooPolice',
  'MR' = 'Miro',
  'MT' = 'MoonlightTorrent',
  'NB' = 'Net::BitTorrent',
  'NX' = 'Net Transport',
  'OS' = 'OneSwarm',
  'OT' = 'OmegaTorrent',
  'PB' = 'Protocol::BitTorrent',
  'PD' = 'Pando',
  'PI' = 'PicoTorrent',
  'PT' = 'PHPTracker',
  'qB' = 'qBittorrent',
  'QD' = 'QQDownload',
  'QT' = 'Qt 4 Torrent example',
  'RT' = 'Retriever',
  'RZ' = 'RezTorrent',
  'S~' = 'Shareaza alpha/beta',
  'SB' = '~Swiftbit',
  'SD' = 'Thunder (aka XùnLéi)',
  'SM' = 'SoMud',
  'SP' = 'BitSpirit',
  'SS' = 'SwarmScope',
  'ST' = 'SymTorrent',
  'st' = 'sharktorrent',
  'SZ' = 'Shareaza',
  'TB' = 'Torch',
  'TE' = 'terasaur Seed Bank',
  'TL' = 'Tribler (versions >= 6.1.0)',
  'TN' = 'TorrentDotNET',
  'TR' = 'Transmission',
  'TS' = 'Torrentstorm',
  'TT' = 'TuoTu',
  'UL' = 'uLeecher!',
  'UM' = 'µTorrent for Mac',
  'UT' = 'µTorrent',
  'VG' = 'Vagaa',
  'WD' = 'WebTorrent Desktop',
  'WT' = 'BitLet',
  'WW' = 'WebTorrent',
  'WY' = 'FireTorrent',
  'XF' = 'Xfplay',
  'XL' = 'Xunlei',
  'XS' = 'XSwifter',
  'XT' = 'XanTorrent',
  'XX' = 'Xtorrent',
  'ZT' = 'ZipTorrent'
}

// Shadow的样式使用以下编码：
// 一个ASCII字母数字用于客户端标识，最多五个字符用于版本号（如果少于五个，则用“-”填充），后跟三个字符（通常为“---”，但并非总是如此），后跟随机字符。
// 版本字符串中的每个字符表示从0到63的数字。 '0'=0，...，'9'=9，'A'=10，...，'Z'=35，'a'=36，...，'z'=61，'.'=62，'-'=63。
// Shadow对编码风格的完整解释（包括关于版本字符串后三个字符如何使用的现有约定的信息）可以在这里找到:http://forums.degreez.net/viewtopic.php?t=7070
// 例如：'S58B-----' 表示Shadow的5.8.11
export enum ShadowStyleClient {
  'A' = 'ABC',
  'O' = 'Osprey Permaseed',
  'Q' = 'BTQueue',
  'R' = 'Tribler(versions < 6.1.0)',
  'S' = "Shadow's Client",
  'T' = 'BitTornado',
  'U' = 'UPnP NAT Bit Torrent'
}

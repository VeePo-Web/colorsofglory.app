export type SeoArea = {
  slug: string;
  name: string;
  region: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  localAngles: string[];
  primaryKeyword: string;
  keywords: string[];
  services: {
    realEstate: string;
    venues?: string;
    agriculture?: string;
    business: string;
  };
  nearby: string[];
  cta: string;
};

export const areaPages: SeoArea[] = [
  {
    slug: "calgary",
    name: "Calgary",
    region: "Calgary",
    title: "Drone Photography Calgary | Fly4MEdia",
    description:
      "Premium drone photography and aerial video in Calgary for real estate listings, businesses, venues, tourism, and commercial campaigns.",
    h1: "Drone photography in Calgary",
    intro:
      "Calgary gives aerial media a rare mix: downtown density, luxury infill, estate neighbourhoods, lake communities, foothill views, and fast-moving commercial launches. Fly4MEdia films properties, places, and campaigns with the restraint of a cinematographer, not the habits of a generic drone operator.",
    localAngles: [
      "Luxury and infill neighbourhoods including Altadore, Britannia, Bel-Aire, Aspen Woods, West Springs, and Upper Mount Royal.",
      "High-value listing media for homes where first impression controls buyer attention.",
      "Commercial aerial content for brands, builders, venues, and tourism operators.",
    ],
    primaryKeyword: "drone photography Calgary",
    keywords: [
      "real estate drone video Calgary",
      "aerial photography Calgary",
      "commercial drone video Calgary",
      "FPV drone filming Calgary",
    ],
    services: {
      realEstate:
        "For Calgary listings, aerial video should do more than prove the roof exists. It should frame the street, lot, light, approach, and neighbourhood context so the buyer understands why the property matters before they arrive.",
      venues:
        "Calgary venues, hotels, private estates, and event spaces can use aerial footage to show scale, arrival, outdoor flow, and the atmosphere around the property.",
      business:
        "For businesses and builders, Calgary aerial media turns sites, facilities, teams, and campaigns into assets that can work across websites, ads, social content, and investor decks.",
    },
    nearby: ["cochrane", "springbank", "bearspaw", "aspen-woods"],
    cta: "Plan a Calgary drone shoot",
  },
  {
    slug: "cochrane",
    name: "Cochrane",
    region: "Cochrane",
    title: "Drone Photography Cochrane | Fly4MEdia",
    description:
      "Cochrane drone photography and aerial video for real estate, golf-course homes, acreages, businesses, and Bow River valley properties.",
    h1: "Drone photography in Cochrane",
    intro:
      "Cochrane is built for aerial storytelling: hillside homes, Bow River valley views, golf-course communities, new neighbourhoods, and western-edge light that can make a listing or campaign feel larger than a location pin.",
    localAngles: [
      "GlenEagles, Sunset Ridge, Riversong, Heartland, Heritage Hills, and East End/Downtown Cochrane.",
      "Hillside and valley properties where elevation, approach, and landscape are part of the sale.",
      "Useful for builders, realtors, tourism brands, and local businesses that need sharper visual authority.",
    ],
    primaryKeyword: "drone photography Cochrane",
    keywords: [
      "Cochrane real estate drone video",
      "aerial photography Cochrane",
      "drone videographer Cochrane",
      "GlenEagles drone photography",
    ],
    services: {
      realEstate:
        "Cochrane real estate benefits from footage that shows grade, valley, mountain sightlines, trail access, and the relationship between the home and the landscape.",
      venues:
        "Event spaces and local destinations around Cochrane can use aerial media to show arrival, setting, and outdoor atmosphere.",
      agriculture:
        "Nearby acreages, land parcels, and rural properties can be documented with clean aerial passes that show access, boundaries, features, and usable land.",
      business:
        "Cochrane businesses can use aerial content to give websites, social campaigns, and recruitment media a more cinematic local presence.",
    },
    nearby: ["gleneagles", "bearspaw", "ghost-lake", "bragg-creek"],
    cta: "Book Cochrane aerial media",
  },
  {
    slug: "canmore",
    name: "Canmore",
    region: "Bow Valley",
    title: "Drone Photography Canmore | Fly4MEdia",
    description:
      "Canmore drone photography and aerial video for mountain real estate, tourism, wedding venues, resorts, and commercial content.",
    h1: "Drone photography in Canmore",
    intro:
      "Canmore needs aerial media with patience. The mountains already have scale; the work is knowing when to move, when to hold, and how to make real estate, tourism, venues, and destination brands feel cinematic without becoming a postcard.",
    localAngles: [
      "Benchlands, Silvertip, Three Sisters, Spring Creek, Cougar Creek, Rundleview, Larch, and Peaks of Grassi.",
      "Mountain tourism, resort, golf, hospitality, and wedding venue content.",
      "Luxury mountain real estate where trails, ridgelines, light, and valley context matter.",
    ],
    primaryKeyword: "drone photography Canmore",
    keywords: [
      "Canmore aerial video",
      "tourism drone video Canmore",
      "wedding venue drone video Canmore",
      "Canmore real estate drone photography",
    ],
    services: {
      realEstate:
        "For Canmore listings, aerial footage should connect the home to ridgelines, trail systems, downtown access, and the feeling of being held by the Bow Valley.",
      venues:
        "Wedding venues, resorts, golf properties, and hospitality brands can use aerial video to show the arrival, ceremony context, mountain scale, and guest experience.",
      business:
        "Tourism operators and local brands can turn seasonal landscapes, movement, and destination context into content built for campaigns, websites, and social platforms.",
    },
    nearby: ["bragg-creek", "ghost-lake", "cochrane", "springbank"],
    cta: "Film a Canmore property or destination",
  },
  {
    slug: "springbank",
    name: "Springbank",
    region: "Rocky View County",
    title: "Drone Photography Springbank | Fly4MEdia",
    description:
      "Springbank drone photography for luxury acreages, estate homes, ranch properties, real estate listings, and commercial aerial content.",
    h1: "Drone photography in Springbank",
    intro:
      "Springbank is one of Alberta's strongest local SEO opportunities for aerial media: custom estates, acreage lots, mountain views, golf communities, and quick Calgary access all need to be seen from above to be understood.",
    localAngles: [
      "Aventerra, Springbank Hill, Springbank Links, Pinnacle Ridge, Pinebrook, Windhorse Manor, and Swift Creek.",
      "Acreage and estate properties where lot shape, privacy, driveway approach, and mountain views influence value.",
      "Strong fit for realtors, builders, landowners, and farm/ranch-adjacent property media.",
    ],
    primaryKeyword: "drone photography Springbank",
    keywords: [
      "Springbank acreage drone photography",
      "estate listing video Springbank",
      "Springbank aerial photography",
      "luxury real estate drone video Springbank",
    ],
    services: {
      realEstate:
        "Springbank listing media needs to show the whole estate story: lot, privacy, views, outbuildings, approach, landscaping, and the short connection back into Calgary.",
      venues:
        "Private estates and rural event properties can use aerial footage to show ceremony grounds, parking, guest flow, and mountain-view setting.",
      agriculture:
        "Acreages, hobby farms, and land parcels benefit from aerial documentation that makes scale and features clear.",
      business:
        "Builders, designers, and trades can use Springbank aerial content to document finished work and market high-end estate projects.",
    },
    nearby: ["bearspaw", "elbow-valley", "aspen-woods", "calgary"],
    cta: "Capture a Springbank acreage",
  },
  {
    slug: "bearspaw",
    name: "Bearspaw",
    region: "Rocky View County",
    title: "Drone Photography Bearspaw | Fly4MEdia",
    description:
      "Bearspaw drone photography for luxury estates, acreages, Watermark homes, equestrian properties, golf communities, and real estate video.",
    h1: "Drone photography in Bearspaw",
    intro:
      "Bearspaw sits between Calgary and Cochrane with rolling estate lots, mountain and prairie views, equestrian properties, golf access, and communities like Watermark. Aerial media is not optional here; it is how the property makes sense.",
    localAngles: [
      "Watermark, Silverhorn, rural estate lots, golf amenities, trails, and equestrian context.",
      "High-value acreage real estate where landscape and privacy are central selling points.",
      "Strong content fit for realtors, builders, stables, venues, and estate property owners.",
    ],
    primaryKeyword: "drone photography Bearspaw",
    keywords: [
      "Bearspaw acreage drone video",
      "luxury real estate drone photography Bearspaw",
      "Watermark Bearspaw aerial photography",
      "equestrian property drone video Alberta",
    ],
    services: {
      realEstate:
        "Bearspaw real estate footage should communicate privacy, topography, approach, outdoor amenities, and the way the home sits inside its acreage.",
      venues:
        "Estate venues, golf properties, and private event settings can use aerial footage to clarify arrival, parking, landscape, and guest experience.",
      agriculture:
        "Acreage and equestrian properties can be filmed to show paddocks, access, buildings, and usable land without flattening the story.",
      business:
        "Builders, designers, and local brands can use Bearspaw aerial content to signal premium work in a premium market.",
    },
    nearby: ["cochrane", "springbank", "gleneagles", "calgary"],
    cta: "Book Bearspaw estate media",
  },
  {
    slug: "elbow-valley",
    name: "Elbow Valley",
    region: "Rocky View County",
    title: "Drone Photography Elbow Valley | Fly4MEdia",
    description:
      "Elbow Valley drone photography and aerial video for estate homes, private lakes, luxury listings, venues, and acreage properties.",
    h1: "Drone photography in Elbow Valley",
    intro:
      "Elbow Valley's value lives in the relationship between estate homes, private lakes, protected land, trails, golf access, and natural quiet. Aerial footage can reveal that relationship in a way ground-level media cannot.",
    localAngles: [
      "Elbow Valley, Braemar, Clearwater, Stonepine, Swift Creek Villas, West Meadows, and Elbow River Estates.",
      "Private lakes, wetlands, trail networks, large floor plans, and rustic-modern estate architecture.",
      "Strong real estate, venue, and acreage content potential.",
    ],
    primaryKeyword: "drone photography Elbow Valley",
    keywords: [
      "Elbow Valley real estate drone video",
      "lakefront estate aerial photography",
      "Elbow Valley aerial photography",
      "luxury home drone video Elbow Valley",
    ],
    services: {
      realEstate:
        "Elbow Valley listings need aerial footage that shows the home, the land, the water, the trails, and the privacy as one coherent living experience.",
      venues:
        "Private lake and estate settings can be filmed for weddings, events, and brand campaigns that need place to feel immediate.",
      agriculture:
        "Large lots and estate parcels can be documented from above to show access, outdoor features, and landscape structure.",
      business:
        "Architects, builders, and luxury service businesses can use Elbow Valley media to communicate premium outcomes with local credibility.",
    },
    nearby: ["springbank", "bragg-creek", "bearspaw", "ghost-lake"],
    cta: "Capture Elbow Valley from above",
  },
  {
    slug: "ghost-lake",
    name: "Ghost Lake",
    region: "Rocky View County",
    title: "Drone Photography Ghost Lake | Fly4MEdia",
    description:
      "Ghost Lake drone photography for lakefront homes, CottageClub properties, recreation brands, vacation homes, and waterfront aerial video.",
    h1: "Drone photography in Ghost Lake",
    intro:
      "Ghost Lake properties are sold through setting: shoreline, water access, recreation, privacy, and the feeling of a second-home escape within reach of Calgary. Aerial media makes those advantages visible fast.",
    localAngles: [
      "CottageClub, Ghost Lake Village, private beaches, boat launch access, trails, and year-round recreation.",
      "Lakefront, recreational, and vacation-home content where water and amenity context sell the story.",
      "Strong fit for real estate, tourism, hospitality, and family recreation brands.",
    ],
    primaryKeyword: "drone photography Ghost Lake",
    keywords: [
      "lakefront property drone video",
      "CottageClub aerial photography",
      "Ghost Lake real estate drone photography",
      "waterfront drone video Alberta",
    ],
    services: {
      realEstate:
        "Ghost Lake real estate media should show shoreline context, access, views, recreation, roads, and the emotional promise of being near water.",
      venues:
        "Lakefront venues and recreation properties can use aerial content to show outdoor flow, arrival, and atmosphere.",
      business:
        "Tourism and recreation businesses around Ghost Lake can turn seasonal activity, shoreline movement, and water access into conversion-focused content.",
    },
    nearby: ["cochrane", "bearspaw", "bragg-creek", "canmore"],
    cta: "Book Ghost Lake aerial content",
  },
  {
    slug: "bragg-creek",
    name: "Bragg Creek",
    region: "Rocky View County",
    title: "Drone Photography Bragg Creek | Fly4MEdia",
    description:
      "Bragg Creek drone photography and aerial video for forested acreages, ranch properties, wedding venues, tourism, and local businesses.",
    h1: "Drone photography in Bragg Creek",
    intro:
      "Bragg Creek and Redwood Meadows carry a different Alberta texture: forest, trails, rustic venues, golf, cabins, river settings, and Kananaskis access. The aerial story should feel grounded, not generic.",
    localAngles: [
      "Rustic charm, forested properties, trails, art galleries, golf, Redwood Meadows, and proximity to Kananaskis.",
      "Excellent fit for wedding venues, cabins, tourism, retreats, land parcels, and acreage listings.",
      "Strong opportunity for content that blends lifestyle, nature, and commercial intent.",
    ],
    primaryKeyword: "drone photography Bragg Creek",
    keywords: [
      "ranch drone footage Bragg Creek",
      "wedding venue aerial video Bragg Creek",
      "Bragg Creek real estate drone video",
      "tourism drone video Bragg Creek",
    ],
    services: {
      realEstate:
        "Bragg Creek real estate footage should show forest cover, access, river or trail proximity, privacy, and the feeling of leaving the city without disappearing from it.",
      venues:
        "Wedding venues, retreats, cabins, and outdoor event properties can use aerial media to reveal the arrival, ceremony setting, and landscape.",
      agriculture:
        "Rural parcels and ranch-style properties can be filmed to show boundaries, access, outbuildings, and terrain.",
      business:
        "Local tourism, recreation, and hospitality businesses can use drone content to make the Bragg Creek setting part of the offer.",
    },
    nearby: ["elbow-valley", "ghost-lake", "cochrane", "canmore"],
    cta: "Plan a Bragg Creek drone shoot",
  },
  {
    slug: "aspen-woods",
    name: "Aspen Woods",
    region: "Calgary",
    title: "Drone Photography Aspen Woods | Fly4MEdia",
    description:
      "Aspen Woods drone photography for luxury real estate listings, estate homes, builder content, and West Calgary aerial video.",
    h1: "Drone photography in Aspen Woods",
    intro:
      "Aspen Woods has the ingredients that make aerial listing media valuable: mountain views, estate homes, large lots, premium schools, and West Calgary access. The right footage turns those details into a faster first impression.",
    localAngles: [
      "Upscale West Calgary community with mountain views, estate homes, schools, parks, and West Hills access.",
      "Strong fit for luxury real estate, builder portfolios, infill/renovation reveals, and neighbourhood context.",
      "A natural bridge page between Calgary-wide SEO and Springbank/West Calgary estate intent.",
    ],
    primaryKeyword: "real estate drone photography Aspen Woods",
    keywords: [
      "luxury listing video Aspen Woods",
      "aerial property photography West Calgary",
      "Aspen Woods drone photography",
      "West Calgary real estate drone video",
    ],
    services: {
      realEstate:
        "Aspen Woods listings need aerial footage that captures lot presence, street context, mountain orientation, landscaping, and proximity to premium West Calgary amenities.",
      venues:
        "Private events and lifestyle properties can use aerial clips to show outdoor areas, views, and arrival.",
      business:
        "Builders, renovation teams, and real estate brands can use Aspen Woods aerial content to communicate premium work in a recognizable market.",
    },
    nearby: ["calgary", "springbank", "elbow-valley", "bearspaw"],
    cta: "Launch an Aspen Woods listing",
  },
  {
    slug: "gleneagles",
    name: "GlenEagles",
    region: "Cochrane",
    title: "Drone Photography GlenEagles | Fly4MEdia",
    description:
      "GlenEagles drone photography for golf-course homes, Bow River valley views, Cochrane real estate listings, and aerial video.",
    h1: "Drone photography in GlenEagles",
    intro:
      "GlenEagles is a Cochrane page worth building early because its visual value is obvious: hillside homes, the Links of GlenEagles, Bow River valley views, trails, and a premium edge-of-town feel.",
    localAngles: [
      "Golf-course homes, panoramic Rockies views, Bow River valley sightlines, and trail access.",
      "High-fit for real estate agents marketing view properties and golf community homes.",
      "Supports both Cochrane SEO and long-tail neighbourhood ranking.",
    ],
    primaryKeyword: "drone photography GlenEagles Cochrane",
    keywords: [
      "golf-course real estate drone video",
      "Bow River valley aerials",
      "GlenEagles aerial photography",
      "Cochrane golf course home drone video",
    ],
    services: {
      realEstate:
        "GlenEagles listings benefit from aerial media that frames the golf course, slope, valley views, driveway approach, and connection back to Cochrane.",
      venues:
        "Golf and event-related properties can use aerial footage to show landscape, scale, and guest experience.",
      business:
        "Local businesses and real estate brands can use GlenEagles content to signal a premium Cochrane presence.",
    },
    nearby: ["cochrane", "bearspaw", "ghost-lake", "springbank"],
    cta: "Film a GlenEagles property",
  },
];

export const areaGroups = [
  {
    title: "Calgary luxury and infill",
    areas: ["calgary", "aspen-woods"],
    description:
      "Listing launches, builder portfolios, premium neighbourhood context, and commercial aerial content.",
  },
  {
    title: "Cochrane and western edge communities",
    areas: ["cochrane", "gleneagles"],
    description:
      "Hillside homes, Bow River valley views, golf communities, and real estate campaigns with landscape value.",
  },
  {
    title: "Springbank, Bearspaw, and Elbow Valley acreages",
    areas: ["springbank", "bearspaw", "elbow-valley"],
    description:
      "Luxury estates, acreage properties, equestrian land, private lakes, and mountain-view homes.",
  },
  {
    title: "Canmore, Bragg Creek, and destination areas",
    areas: ["canmore", "bragg-creek", "ghost-lake"],
    description:
      "Tourism, venues, mountain real estate, waterfront homes, and outdoor recreation brands.",
  },
];

export const hubFaqs = [
  {
    question: "Where does Fly4MEdia offer drone photography?",
    answer:
      "Fly4MEdia serves Calgary, Cochrane, Canmore, Springbank, Bearspaw, Elbow Valley, Ghost Lake, Bragg Creek, and surrounding Alberta communities.",
  },
  {
    question: "Do you film real estate listings and acreages?",
    answer:
      "Yes. Real estate, luxury homes, acreages, ranch-style properties, waterfront homes, and mountain listings are core use cases for Fly4MEdia.",
  },
  {
    question: "Can drone footage be used for venues and tourism brands?",
    answer:
      "Yes. Aerial footage is useful for wedding venues, resorts, tourism operators, recreation brands, golf properties, and destination campaigns.",
  },
];

export function getAreaBySlug(slug: string): SeoArea | undefined {
  return areaPages.find((area) => area.slug === slug);
}

export function getNearbyAreas(slug: string): SeoArea[] {
  const area = getAreaBySlug(slug);
  if (!area) return [];

  return area.nearby
    .map((nearbySlug) => getAreaBySlug(nearbySlug))
    .filter((nearby): nearby is SeoArea => Boolean(nearby));
}

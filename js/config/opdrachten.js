/* Contracts from the lord of the region.
 *
 * Each template asks for one resource before a deadline. The amount scales
 * with the town so a contract stays a stretch, never a formality:
 *   aantal = basis + perInwoner * inwoners, rounded to tens.
 * `nodig` keeps a contract from being handed out before you can possibly
 * fill it. Rewards are coins plus a bit of morale for a job well done. */
(function (Game) {

  Game.config.opdrachten = [
    {
      id: 'brood', tijdperk: 2, res: 'brood', basis: 45, perInwoner: 0.7, dagen: 16,
      munten: 90, moreel: 5, nodig: 'bakkerij',
      tekst: 'De heer verwacht brood voor zijn hofhouding.'
    },
    {
      id: 'hout', tijdperk: 2, res: 'hout', basis: 120, perInwoner: 2.2, dagen: 14,
      munten: 70, moreel: 4,
      tekst: 'Er wordt een brug gebouwd stroomafwaarts. Lever het hout.'
    },
    {
      id: 'steen', tijdperk: 2, res: 'steen', basis: 90, perInwoner: 1.6, dagen: 16,
      munten: 85, moreel: 4,
      tekst: 'De heer versterkt zijn burcht en vraagt steen uit jouw groeve.'
    },
    {
      id: 'vlees', tijdperk: 2, res: 'vlees', basis: 60, perInwoner: 1.0, dagen: 12,
      munten: 75, moreel: 5,
      tekst: 'Er komt een jachtgezelschap langs dat gevoed wil worden.'
    },
    {
      id: 'gereedschap', tijdperk: 3, res: 'gereedschap', basis: 30, perInwoner: 0.5, dagen: 18,
      munten: 170, moreel: 6, nodig: 'smederij',
      tekst: 'De heer rust een werkploeg uit en heeft gereedschap nodig.'
    },
    {
      id: 'ijzer', tijdperk: 3, res: 'ijzer', basis: 60, perInwoner: 0.9, dagen: 16,
      munten: 140, moreel: 5, nodig: 'ijzermijn',
      tekst: 'De wapensmid van de heer vraagt om ruw ijzer.'
    },
    {
      id: 'edelsteen', tijdperk: 4, res: 'edelsteen', basis: 18, perInwoner: 0.22, dagen: 20,
      munten: 320, moreel: 8, nodig: 'edelsteenmijn',
      tekst: 'Voor de kroon van de gravin worden edelstenen gezocht.'
    },
    {
      id: 'graan', tijdperk: 2, res: 'graan', basis: 110, perInwoner: 1.8, dagen: 14,
      munten: 65, moreel: 4,
      tekst: 'Een naburig dorp had een misoogst. De heer vraagt graan.'
    }
  ];

})(window.Game);

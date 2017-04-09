"use strict";
/* globals _, d3 */

function Vaalikone(questions, peopleWithAnswers) {

    peopleWithAnswers.forEach(person => {
        // round all answers to integer values
        person.answers = _.mapValues(person.answers, Math.round);
    });

    const partyAnswers = d3.nest()
        .key(d => d.person.party)
        .entries(peopleWithAnswers);

    this.questions = questions;
    this.parties = partyAnswers.map(d => d.key);
    this.cities = _.uniq(peopleWithAnswers.map(p => p.person.city));

    this.partyAnswerMatrix = _.fromPairs(
        partyAnswers.map(group => [
            group.key,
            _.fromPairs(
                _.keys(questions).map(q => [
                    q,
                    group.values
                        .map(d => d.answers[q])
                        .filter(x => x !== undefined)
                ])
            )
        ])
    );

    this.answerOptions = _.uniq(
        _.flatten(peopleWithAnswers.map(d => _.values(d.answers)))
    );
    this.answerOptions.sort();

    this.subplotSize = {
        w: 200,
        h: 50
    };
    this.defineColors();

    //console.log(this.answerOptions);
    //console.log(this.partyAnswerMatrix);
    //console.log(this.cities);
}

Vaalikone.prototype.defineColors = function() {

    const minX = d3.min(this.answerOptions);
    const colorScale = d3.scaleLinear()
        .domain([minX, d3.max(this.answerOptions)])
        .range([0, 1]);

    const rgb = (arr) => 'rgb('+arr.map(x => x*255).map(Math.round).join(',')+')';

    const colorMaps = brightness => {
        return x => {
            let c = colorScale(x);

            let sat = Math.sqrt(Math.abs(c - 0.5)*2.0);
            const bright = brightness || sat*0.3 + 0.7;

            return rgb([
                    1.0 - (c-2/3)*3,
                    c*2,
                    0.0
                ]
                .map(v => Math.min(Math.max(v, 0), 1))
                .map(v => (v*sat + 1.0 - sat)*bright));
        };
    };

    this.histogramColormap = colorMaps();
    this.textColormap = colorMaps(0.7);
};

Vaalikone.prototype.computeMean = function(histogram) {
    return _.sum(_.map(histogram, (k, v) => k*v)) / _.sum(_.values(histogram));
};

Vaalikone.prototype.renderHistogram = function(d3root, data) {

    const total = _.sum(_.values(data));

    const barWidth = this.subplotSize.w / (this.answerOptions.length+1);
    const minX = d3.min(this.answerOptions);
    const maxR = barWidth / Math.sqrt(2);
    const maxHeight = this.subplotSize.h;
    const xStart = 0.5 / Math.sqrt(2) * barWidth;

    const radius = x => Math.sqrt((data[x] || 0) / total) * maxR;

    const bars = d3root
        .selectAll('circle')
        .data(this.answerOptions);

    bars.exit().remove();

    bars
        .enter()
            .append('circle')
            .attr('cx', x => (x-minX + 0.5) * barWidth + xStart)
            .attr('cy', maxHeight*0.5)
            .attr('fill', this.histogramColormap)
        .merge(bars)
            .transition()
            .attr('r', radius);

    return this.textColormap(this.computeMean(data));
};

Vaalikone.prototype.renderPartyRow = function(d3root, party, data, questionId, selectedParty) {

    const title = d3root
        .selectAll('div.title')
        .data([party]);

    const that = this;
    const titleText = title
        .enter()
            .append('div')
            .classed('title', true)
            .classed('col-4', true)
        .merge(title)
            .text(d => d)
            .on('click', d => {
                that.renderQuestion(questionId, party);
                that.renderQuestionList(party);
            });

    const histogram = d3root
        .selectAll('div.histogram')
        .data([party]);

    let color =
        this.renderHistogram(histogram
            .enter()
                .append('div')
                .classed('histogram', true)
                .classed('col', true)
                    .append('svg')
                        .attr('width', this.subplotSize.w)
                        .attr('height', this.subplotSize.h)
                    .merge(histogram), data);

    if (selectedParty) {
        titleText.style('font-weight', selectedParty === party ? 'bold' : 'normal');
        titleText.style('color', selectedParty === party ? 'black' : 'gray');
    } else {
        titleText.style('color', color);
    }
};

Vaalikone.prototype.renderQuestion = function(questionId, selectedParty) {

    const options = this.answerOptions;
    const byParty = _.mapValues(this.partyAnswerMatrix,
        answers => _.fromPairs(d3.nest()
            .key(d => d).sortKeys(d3.ascending)
            .rollup(d => d.length)
            .entries(answers[questionId])
            .map(obj => [obj.key, obj.value])));

    //console.log(byParty);

    const that = this;
    const parties = _.keys(byParty).filter(p => !_.isEmpty(byParty[p]));
    const means = _.fromPairs(
        parties.map(p => [p, -that.computeMean(byParty[p])]));

    const subplots = this.graphColumn
        .selectAll('div.row')
        .data(_.sortBy(parties, p => means[p]));

    subplots.exit().remove();

    subplots.enter()
            .append('div')
            .classed('row', true)
        .merge(subplots)
            .transition()
            .each(function(d) {
                that.renderPartyRow(d3.select(this), d, byParty[d], questionId, selectedParty);
            });
};

Vaalikone.prototype.renderQuestionList = function(party) {

    let data = _.toPairs(this.questions)
        .map(d => { return { id: d[0], text: d[1] }; });

    if (party) {

        const byQuestion = _.fromPairs(_.keys(this.questions)
            .map(questionId => {
                const means =_.mapValues(this.partyAnswerMatrix,
                    answers => _.mean(answers[questionId]));

                return [
                    questionId,
                    {
                        partyMean: means[party],
                        meanOfMeans: _.mean(_.values(means).filter(_.isFinite))
                    }
                ];
            })
        );

        //console.log(byQuestion);

        data.forEach(d => {
            d.partyValue = byQuestion[d.id].partyMean;
        });

        data = data.filter(d => this.partyAnswerMatrix[party][d.id].length > 0);
        data = _.sortBy(data, d => -(d.partyValue - byQuestion[d.id].meanOfMeans));
    }

    this.questionList.html(''); // clear

    const questions = this.questionList
        .selectAll('li a')
        .data(data);

    const that = this;

    const NO_ACTION = 'javascript:void(0)';

    const questionTexts = questions.enter()
            .append('li')
            .append('a')
                .attr('href', NO_ACTION)
        .merge(questions)
            .on('mousedown', d => that.renderQuestion(d.id, party))
            .text(d => d.text)
            .attr('style', d => {
                if (party) {
                    return 'color: ' + that.textColormap(d.partyValue);
                }
                return '';
            });
};

Vaalikone.prototype.start = function(d3root) {

    const container = d3root
        .append('div')
        .classed('row', true);

    this.questionList =
        container
            .append('div')
            .classed('question-column', true)
                .append('ul');

    this.graphColumn =
        container
            .append('div')
            .classed('graph-column', true);

    this.renderQuestionList();
};

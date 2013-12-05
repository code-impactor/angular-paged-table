(function () {
  angular.module("angular-table", ["ui.bootstrap", "ngSanitize"]);

  angular.module("angular-table").directive("atTable", [
    "metaCollector", "setupFactory", function (metaCollector, setupFactory) {
      var constructHeader, normalizeInput, validateInput;

      constructHeader = function (customHeaderMarkup, bodyDefinitions) {
        var icon, th, title, tr;
        tr = angular.element("<tr></tr>");
        angular.forEach(bodyDefinitions, function (td) {
          th = angular.element("<th style='cursor: pointer;'></th>");
          if (customHeaderMarkup[td.attribute]) {
            angular.forEach(customHeaderMarkup[td.attribute].attributes, function (attribute) {
              th.attr("" + attribute.name, "" + attribute.value);
            });
            title = customHeaderMarkup[td.attribute].content
          } else {
            title = td.title;
          }
          th.html("" + title);
          if (td.sortable) {
            th.attr("ng-click", "predicate = '" + td.attribute + "'; descending = !descending;");
            icon = angular.element("<i style='margin-left: 10px;'></i>");
            icon.attr("ng-class", "getSortIcon('" + td.attribute + "')");
            th.append(icon);
          }
          th.attr("width", td.width);
          tr.append(th);
        });
        return tr;
      };
      validateInput = function (attributes) {
        if (attributes.pagination && attributes.list) {
          throw "You can not specify a list if you have specified a pagination. The list defined for the pagnination will automatically be used.";
        }
        if (!attributes.pagination && !attributes.list) {
          throw "Either a list or pagination must be specified.";
        }
      };
      normalizeInput = function (attributes) {
        if (attributes.atPagination) {
          attributes.pagination = attributes.atPagination;
          return attributes.atPagination = null;
        }
      };
      return {
        restrict: "AC",
        scope: true,
        compile: function (element, attributes, transclude) {
          var bodyDefinition, customHeaderMarkup, setup, tbody, thead, tr;

          normalizeInput(attributes);
          validateInput(attributes);
          thead = element.find("thead");
          tbody = element.find("tbody");
          bodyDefinition = metaCollector.collectBodyDefinition(tbody);
          if (thead[0]) {
            customHeaderMarkup = metaCollector.collectCustomHeaderMarkup(thead);
            tr = thead.find("tr");
            tr.remove();
            thead.append(constructHeader(customHeaderMarkup, bodyDefinition.tds));
          }
          setup = setupFactory(attributes);
          setup.compile(element, attributes, transclude);
          return {
            post: function ($scope, $element, $attributes) {
              if (bodyDefinition.initialSorting) {
                $scope.predicate = bodyDefinition.initialSorting.predicate;
                $scope.descending = bodyDefinition.initialSorting.direction === "desc";
              }
              $scope.getSortIcon = function (predicate) {
                if (predicate !== $scope.predicate) {
                  return "icon-minus";
                }
                if ($scope.descending) {
                  return "icon-chevron-down";
                } else {
                  return "icon-chevron-up";
                }
              };
              return setup.link($scope, $element, $attributes);
            }
          };
        }
      };
    }
  ]);

  angular.module("angular-table").directive("atImplicit", [
    function () {
      return {
        restrict: "AC",
        compile: function (element, attributes, transclude) {
          var attribute;

          attribute = element.attr("attribute");
          if (!attribute) {
            throw "at-implicit specified without attribute: " + (element.html());
          }
          return element.append("{{item." + attribute + "}}");
        }
      };
    }
  ]);

  angular.module("angular-table").directive("atPagination", [
    function ($parse) {
      return {
        replace: true,
        restrict: "E",
        template: "" +
          "<div class='pagination' style='margin: 0px;'>" +
            "<ul>" +
              "<li ng-class='{active: page.active, disabled: page.disabled}' ng-repeat='page in pages'>" +
                "<a href='' ng-click='goToPage(page.number)' ng-bind-html='page.text'></a>" +
              "</li>" +
            "</ul>" +
          "</div>",
        scope: {
          itemsPerPage: "@",
          instance: "=",
          list: "="
        },
        link: function ($scope, $element, $attributes) {
          var normalizePage, update, maxSize;

          $scope.instance = $scope;
          $scope.currentPage = 0;
          normalizePage = function (page) {
            page = Math.max(0, page);
            page = Math.min($scope.numberOfPages - 1, page);
            return page;
          };
          // Create page object used in template
          function makePage(number, text, isActive, isDisabled) {
            return {
              number: number,
              text: text,
              active: isActive,
              disabled: isDisabled
            };
          }

          var getPages = function (currentPage) {
            var pages = [];
            // Default page limits
            $scope.numberOfPages = Math.ceil($scope.list.length / $scope.itemsPerPage);
            var maxSize = parseInt($attributes.maxSize, 10) || 5;

            // Default page limits
            var startPage = 0,
              endPage = $scope.numberOfPages - 1;
            var isMaxSized = (angular.isDefined(maxSize) && maxSize < $scope.numberOfPages);


            // recompute if maxSize
            if (isMaxSized && maxSize > 0) {
              startPage = ((Math.ceil(($scope.currentPage + 1) / maxSize) - 1) * maxSize);
              endPage = Math.min(startPage + maxSize - 1, ($scope.numberOfPages - 1));
            }
            // Add page number links
            for (var number = startPage; number <= endPage; number++) {
              var page = makePage(number, '<i>' + (number + 1) + '</i>', (currentPage === number), false);
              pages.push(page);
            }

            // Add previous & next links
            var previousPage = makePage(currentPage - 1, '<i class="icon-backward"></i>', false, (currentPage === 0));
            pages.unshift(previousPage);

            var nextPage = makePage(currentPage + 1, '<i class="icon-forward"></i>', false, (currentPage === ($scope.numberOfPages - 1)));
            pages.push(nextPage);

            // Add links to move between page sets
            if (isMaxSized && maxSize > 0) {
              if (startPage > 0) {
                var previousPageSet = makePage(startPage - 1, '<i class="icon-fast-backward">...</i>', false, false);
                pages.unshift(previousPageSet);
              }
              if (endPage < ($scope.numberOfPages - 1)) {
                var nextPageSet = makePage(endPage + 1, '<i class="icon-fast-forward">...</i>', false, false);
                pages.push(nextPageSet);
              }
            }

            // Add first & last links
            var firstPage = makePage(0, '<i class="icon-step-backward"></i>', false, (currentPage === 0));
            pages.unshift(firstPage);

            var lastPage = makePage($scope.numberOfPages, '<i class="icon-step-forward"></i>', false, (currentPage === ($scope.numberOfPages - 1)));
            pages.push(lastPage);

            return pages;
          }
          update = function (reset) {
            if ($scope.list) {
              if ($scope.list.length > 0) {
                return $scope.pages = getPages($scope.currentPage);
              } else {
                $scope.numberOfPages = 1;
                return $scope.pages = [0];
              }
            }
          };
          $scope.fromPage = function () {
            if ($scope.list) {
              return $scope.itemsPerPage * $scope.currentPage - $scope.list.length;
            }
          };
          $scope.getFillerArray = function () {
            var fillerLength, itemCountOnLastPage, results;
            if ($scope.currentPage === $scope.numberOfPages - 1) {
              itemCountOnLastPage = $scope.list.length % $scope.itemsPerPage;
              if (itemCountOnLastPage !== 0 || $scope.list.length === 0) {
                fillerLength = $scope.itemsPerPage - itemCountOnLastPage - 1;
                results = [];
                for (var x = $scope.list.length; x <= ($scope.list.length + fillerLength); x++) {
                  results.push(x);
                }
                return results;
              } else {
                return [];
              }
            }
          };
          $scope.goToPage = function (page) {
            $scope.currentPage = normalizePage(page);
          };
          update();
          $scope.$watch("currentPage", function () {
            return update();
          });
          $scope.$watch("itemsPerPage", function () {
            return update();
          });
          return $scope.$watch("list", function () {
            return update();
          });
        }
      };
    }
  ]);

  angular.module("angular-table").service("metaCollector", [
    function () {
      var capitaliseFirstLetter, extractWidth, getInitialSortDirection, isSortable;

      capitaliseFirstLetter = function (string) {
        if (string) {
          return string.charAt(0).toUpperCase() + string.slice(1);
        } else {
          return "";
        }
      };
      extractWidth = function (classes) {
        var width;

        width = /([0-9]+px)/i.exec(classes);
        if (width) {
          return width[0];
        } else {
          return "";
        }
      };
      isSortable = function (classes) {
        var sortable;

        sortable = /(sortable)/i.exec(classes);
        if (sortable) {
          return true;
        } else {
          return false;
        }
      };
      getInitialSortDirection = function (td) {
        var initialSorting;

        initialSorting = td.attr("initial-sorting");
        if (initialSorting) {
          if (initialSorting === "asc" || initialSorting === "desc") {
            return initialSorting;
          }
          throw "Invalid value for initial-sorting: " + initialSorting + ". Allowed values are 'asc' or 'desc'.";
        }
        return void 0;
      };
      return {
        collectCustomHeaderMarkup: function (thead) {
          var customHeaderMarkup, customHeaderMarkups, th, tr, _i, _len, _ref;
          customHeaderMarkups = {};
          tr = thead.find("tr");
          angular.forEach(tr.find("th"), function (th) {
            th = angular.element(th);
            customHeaderMarkup = customHeaderMarkups[th.attr("attribute")] = {};
            customHeaderMarkup.content = th.html();
            customHeaderMarkup.attributes = th[0].attributes;
          });
          return customHeaderMarkups;
        },
        collectBodyDefinition: function (tbody) {
          var attribute, bodyDefinition, initialSortDirection, sortable, td, title, width;

          bodyDefinition = {};
          bodyDefinition.tds = [];
          bodyDefinition.initialSorting = undefined;
          angular.forEach(tbody.find("td"), function (td) {
            td = angular.element(td);

            attribute = td.attr("attribute");
            title = td.attr("title") || capitaliseFirstLetter(td.attr("attribute"));
            sortable = td[0].attributes.sortable || isSortable(td.attr("class"));
            width = extractWidth(td.attr("class"));

            bodyDefinition.tds.push({
              attribute: attribute,
              title: title,
              sortable: sortable,
              width: width
            });
            initialSortDirection = getInitialSortDirection(td);
            if (initialSortDirection) {
              if (!attribute) {
                throw "initial-sorting specified without attribute.";
              }
              bodyDefinition.initialSorting = {};
              bodyDefinition.initialSorting.direction = initialSortDirection;
              bodyDefinition.initialSorting.predicate = attribute;
            }


          });
          return bodyDefinition;
        }
      };
    }
  ]);

  angular.module("angular-table").factory("setupFactory", [
    function () {
      var PaginationSetup, StandardSetup, limitToExpression, orderByExpression, setupTr;

      orderByExpression = "| orderBy:predicate:descending";
      limitToExpression = "| limitTo:fromPage() | limitTo:toPage()";
      setupTr = function (element, repeatString) {
        var tbody, tr;

        tbody = element.find("tbody");
        tr = tbody.find("tr");
        tr.attr("ng-repeat", repeatString);
        return tbody;
      };
      StandardSetup = function (attributes) {
        var repeatString;

        repeatString = "item in " + attributes.list + " " + orderByExpression;
        this.compile = function (element, attributes, transclude) {
          return setupTr(element, repeatString);
        };
        this.link = function () {
        };
      };
      PaginationSetup = function (attributes) {
        var paginationName, repeatString, sortContext;

        sortContext = attributes.sortContext || "global";
        paginationName = attributes.pagination;
        if (sortContext === "global") {
          repeatString = "item in " + paginationName + ".list " + orderByExpression + " " + limitToExpression;
        } else if (sortContext === "page") {
          repeatString = "item in " + paginationName + ".list " + limitToExpression + " " + orderByExpression + " ";
        } else {
          throw "Invalid sort-context: " + sortContext + ".";
        }
        this.compile = function (element, attributes, transclude) {
          var fillerTr, tbody, td, tdString, tds, _i, _len;

          tbody = setupTr(element, repeatString);
          if (typeof attributes.fillLastPage !== "undefined") {
            tds = element.find("td");
            tdString = "";
            angular.forEach(tds, function (td) {
              tdString += "<td>&nbsp;</td>";
            });

            fillerTr = angular.element("<tr>" + tdString + "</tr>");
            fillerTr.attr("ng-repeat", "item in " + paginationName + ".getFillerArray() ");
            return tbody.append(fillerTr);
          }
        };
        this.link = function ($scope, $element, $attributes) {
          $scope.fromPage = function () {
            if ($scope[paginationName]) {
              return $scope[paginationName].fromPage();
            }
          };
          return $scope.toPage = function () {
            if ($scope[paginationName]) {
              return $scope[paginationName].itemsPerPage;
            }
          };
        };
      };
      return function (attributes) {
        if (attributes.list) {
          return new StandardSetup(attributes);
        }
        if (attributes.pagination) {
          return new PaginationSetup(attributes);
        }
      };
    }
  ]);

}).call(this);